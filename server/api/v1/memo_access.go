package v1

import (
	"context"
	stderrors "errors"
	"regexp"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/usememos/memos/core/access"
	"github.com/usememos/memos/store"
)

// buildMemoReadContext resolves authorization inputs for exactly one memo.
// Relations never contribute access to either endpoint.
func (s *APIV1Service) buildMemoReadContext(ctx context.Context, memo *store.Memo, sharedMemoID *int32) (access.MemoReadContext, error) {
	viewer, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return access.MemoReadContext{}, status.Errorf(codes.Internal, "failed to get user")
	}
	allowAnonymous := false
	if viewer == nil {
		allowAnonymous, err = s.Store.AllowsAnonymousAccess(ctx)
		if err != nil {
			return access.MemoReadContext{}, status.Errorf(codes.Internal, "failed to resolve instance access policy")
		}
	}
	return s.buildMemoReadContextForViewer(ctx, memo, viewer, allowAnonymous, sharedMemoID)
}

func (s *APIV1Service) buildMemoReadContextForViewer(ctx context.Context, memo *store.Memo, viewer *store.User, allowAnonymous bool, sharedMemoID *int32) (access.MemoReadContext, error) {
	if memo == nil {
		return access.MemoReadContext{}, status.Error(codes.NotFound, "memo not found")
	}
	readContext, err := access.ResolveMemoReadContext(ctx, s.Store, memo, viewer, allowAnonymous, sharedMemoID)
	if err != nil {
		return access.MemoReadContext{}, status.Errorf(codes.Internal, "failed to resolve memo access")
	}
	return readContext, nil
}

func (s *APIV1Service) checkMemoReadAccess(ctx context.Context, memo *store.Memo) error {
	readContext, err := s.buildMemoReadContext(ctx, memo, nil)
	if err != nil {
		return err
	}
	return memoAccessDecisionError(access.CheckMemoReadContext(readContext))
}

func memoAccessDecisionError(decision access.MemoReadDecision) error {
	switch decision.Denial {
	case access.MemoReadDenialNone:
		return nil
	case access.MemoReadDenialNotFound:
		return status.Error(codes.NotFound, "memo not found")
	case access.MemoReadDenialUnauthenticated:
		return status.Error(codes.Unauthenticated, "user not authenticated")
	default:
		return status.Error(codes.PermissionDenied, "permission denied")
	}
}

// newMemoAccessScope returns the memo-local authorization predicate for a
// caller. Drivers apply it as a database predicate before LIMIT/OFFSET so
// inaccessible rows can neither leak nor skew counts and pagination.
func newMemoAccessScope(currentUser *store.User, allowPublic bool) *store.MemoAccessScope {
	accessScope := &store.MemoAccessScope{AllowPublic: allowPublic, AllowProtected: currentUser != nil}
	if currentUser != nil {
		accessScope.UserID = &currentUser.ID
	}
	return accessScope
}

// resolveMemoAccessScope resolves the caller and builds their memo access
// scope. For an anonymous caller the instance access policy decides whether
// PUBLIC memos are readable at all. Callers map the returned error to their own
// transport representation.
func (s *APIV1Service) resolveMemoAccessScope(ctx context.Context) (*store.MemoAccessScope, *store.User, error) {
	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, nil, errors.Wrap(err, "failed to get current user")
	}
	allowPublic := currentUser != nil
	if currentUser == nil {
		allowPublic, err = s.Store.AllowsAnonymousAccess(ctx)
		if err != nil {
			return nil, nil, errors.Wrap(err, "failed to resolve instance access policy")
		}
	}
	accessScope := newMemoAccessScope(currentUser, allowPublic)
	if currentUser != nil {
		excluded, err := s.timelineExcludedSpaceIDs(ctx, currentUser.ID)
		if err != nil {
			return nil, nil, errors.Wrap(err, "failed to resolve timeline-excluded spaces")
		}
		accessScope.ExcludeSpaceIDs = excluded
	}
	return accessScope, currentUser, nil
}

// explicitSpaceFilterPattern matches the single-condition space-scope filter
// the frontend sends when a request is scoped to exactly one Space (see
// buildCollectionScopeFilter and the Scratchpad page), e.g. `space ==
// "spaces/abc123"`.
var explicitSpaceFilterPattern = regexp.MustCompile(`^\s*space\s*==\s*"([^"]+)"\s*$`)

// allowExplicitlyRequestedSpace lets a caller see their own timeline-excluded
// Space (their Scratchpad) when a request explicitly names it, without
// opening that Space to any other all-scope query. timelineExcludedSpaceIDs
// only ever includes Spaces the caller is a member of, so a name match here
// is already proof of ownership; this does not affect any other Space.
func (s *APIV1Service) allowExplicitlyRequestedSpace(ctx context.Context, accessScope *store.MemoAccessScope, filter string) {
	if len(accessScope.ExcludeSpaceIDs) == 0 {
		return
	}
	match := explicitSpaceFilterPattern.FindStringSubmatch(filter)
	if match == nil {
		return
	}
	spaceUID, err := ExtractSpaceUIDFromName(match[1])
	if err != nil {
		return
	}
	space, err := s.Store.GetSpace(ctx, &store.FindSpace{UID: &spaceUID})
	if err != nil || space == nil {
		return
	}
	remaining := accessScope.ExcludeSpaceIDs[:0]
	for _, id := range accessScope.ExcludeSpaceIDs {
		if id != space.ID {
			remaining = append(remaining, id)
		}
	}
	accessScope.ExcludeSpaceIDs = remaining
}

// timelineExcludedSpaceIDs returns the Space IDs the caller is a member of
// that are flagged exclude_from_timeline, e.g. their Scratchpad. Callers
// supply this on MemoAccessScope so every list/stats endpoint hides those
// Spaces from all-scope memo collections without each caller remembering to.
func (s *APIV1Service) timelineExcludedSpaceIDs(ctx context.Context, userID int32) ([]int32, error) {
	spaces, err := s.Store.ListSpaces(ctx, &store.FindSpace{MemberUserID: &userID})
	if err != nil {
		return nil, err
	}
	var excluded []int32
	for _, space := range spaces {
		if space.Payload.GetExcludeFromTimeline() {
			excluded = append(excluded, space.ID)
		}
	}
	return excluded, nil
}

// resolveWritableSpaceByName resolves a space resource name and requires the
// caller to be an active member of it. A non-member receives NotFound so that
// an existing collaboration boundary stays indistinguishable from a missing
// resource.
func (s *APIV1Service) resolveWritableSpaceByName(ctx context.Context, name string, userID int32) (*store.Space, error) {
	spaceUID, err := ExtractSpaceUIDFromName(name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid space name: %v", err)
	}
	space, err := s.Store.GetSpace(ctx, &store.FindSpace{UID: &spaceUID})
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get space")
	}
	if space == nil {
		return nil, status.Error(codes.NotFound, "space not found")
	}
	active, err := s.isActiveSpaceMember(ctx, space.ID, userID)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to resolve space membership")
	}
	if !active {
		return nil, status.Error(codes.NotFound, "space not found")
	}
	return space, nil
}

func (s *APIV1Service) isActiveSpaceMember(ctx context.Context, spaceID, userID int32) (bool, error) {
	user, err := s.Store.GetUser(ctx, &store.FindUser{ID: &userID})
	if err != nil {
		return false, err
	}
	if user == nil || user.RowStatus != store.Normal {
		return false, nil
	}
	membership, err := s.Store.GetSpaceMember(ctx, &store.FindSpaceMember{SpaceID: &spaceID, UserID: &userID})
	if err != nil {
		return false, err
	}
	return membership != nil && membership.Role.IsActiveMember(), nil
}

func sameOptionalInt32(left, right *int32) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}
	return *left == *right
}

func memoWritePolicy(actorUserID int32, lifecycleOnly bool) *store.MemoWritePolicy {
	return &store.MemoWritePolicy{
		ActorUserID:   actorUserID,
		LifecycleOnly: lifecycleOnly,
	}
}

func mapMemoWriteError(err error, operation string) error {
	switch {
	case stderrors.Is(err, store.ErrMemoMutationConflict):
		return status.Errorf(codes.FailedPrecondition, "memo state changed: %v", err)
	case stderrors.Is(err, store.ErrMemoSpaceNotWritable):
		return status.Error(codes.FailedPrecondition, "memo space is no longer writable")
	case stderrors.Is(err, store.ErrMemoSpaceMembershipRequired), stderrors.Is(err, store.ErrMemoPermissionDenied):
		return status.Error(codes.PermissionDenied, "permission denied")
	case stderrors.Is(err, store.ErrMemoShareConflict):
		return status.Error(codes.FailedPrecondition, "revoke active shares before using the SPACE audience")
	default:
		return status.Errorf(codes.Internal, "%s: %v", operation, err)
	}
}

func (s *APIV1Service) requireAssignedMemoWritable(ctx context.Context, memo *store.Memo, userID int32) error {
	if memo.SpaceID == nil {
		return nil
	}
	space, err := s.Store.GetSpace(ctx, &store.FindSpace{ID: memo.SpaceID})
	if err != nil {
		return status.Errorf(codes.Internal, "failed to get memo space")
	}
	if space == nil {
		return status.Errorf(codes.FailedPrecondition, "memo has invalid space placement")
	}
	active, err := s.isActiveSpaceMember(ctx, space.ID, userID)
	if err != nil {
		return status.Errorf(codes.Internal, "failed to resolve space membership")
	}
	if !active {
		return status.Errorf(codes.PermissionDenied, "active space membership is required")
	}
	return nil
}
