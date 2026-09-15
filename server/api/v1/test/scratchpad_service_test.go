package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	apiv1server "github.com/usememos/memos/server/api/v1"
	"github.com/usememos/memos/store"
)

func TestGetOrCreateSpaceScratchpadIsPrivateAndIdempotent(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	owner, err := ts.CreateRegularUser(ctx, "scratchpad-parent-owner")
	require.NoError(t, err)
	member, err := ts.CreateRegularUser(ctx, "scratchpad-parent-member")
	require.NoError(t, err)
	outsider, err := ts.CreateRegularUser(ctx, "scratchpad-parent-outsider")
	require.NoError(t, err)

	parent, err := ts.Store.CreateSpace(ctx, &store.Space{UID: "scratchpad-parent", Title: "Parent"}, owner.ID)
	require.NoError(t, err)
	_, err = ts.InviteAndAcceptSpaceMember(ctx, &store.SpaceMember{
		SpaceID: parent.ID,
		UserID:  member.ID,
		Role:    store.SpaceMemberRoleUser,
	}, owner.ID)
	require.NoError(t, err)

	parentName := "spaces/" + parent.UID
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)
	memberCtx := ts.CreateUserContext(ctx, member.ID)
	outsiderCtx := ts.CreateUserContext(ctx, outsider.ID)

	ownerScratchpad, err := ts.Service.GetOrCreateSpaceScratchpad(ownerCtx, &apiv1.GetOrCreateSpaceScratchpadRequest{Parent: parentName})
	require.NoError(t, err)
	require.True(t, ownerScratchpad.IsScratchpad)

	ownerAgain, err := ts.Service.GetOrCreateSpaceScratchpad(ownerCtx, &apiv1.GetOrCreateSpaceScratchpadRequest{Parent: parentName})
	require.NoError(t, err)
	require.Equal(t, ownerScratchpad.Name, ownerAgain.Name)

	memberScratchpad, err := ts.Service.GetOrCreateSpaceScratchpad(memberCtx, &apiv1.GetOrCreateSpaceScratchpadRequest{Parent: parentName})
	require.NoError(t, err)
	require.NotEqual(t, ownerScratchpad.Name, memberScratchpad.Name)

	_, err = ts.Service.GetOrCreateSpaceScratchpad(outsiderCtx, &apiv1.GetOrCreateSpaceScratchpadRequest{Parent: parentName})
	require.Equal(t, codes.NotFound, status.Code(err))

	ownerScratchpadUID := ownerScratchpad.Name[len("spaces/"):]
	ownerScratchpadStore, err := ts.Store.ListSpaces(ctx, &store.FindSpace{UID: &ownerScratchpadUID})
	require.NoError(t, err)
	require.Len(t, ownerScratchpadStore, 1)
	require.True(t, ownerScratchpadStore[0].Payload.GetExcludeFromTimeline())
	require.Equal(t, parent.UID, ownerScratchpadStore[0].Payload.GetParentSpaceUid())

	_, err = ts.Service.CreateSpaceInvitation(ownerCtx, &apiv1.CreateSpaceInvitationRequest{
		Parent: ownerScratchpad.Name,
		SpaceInvitation: &apiv1.SpaceInvitation{
			Invitee: apiv1server.BuildUserName(outsider.Username),
			Role:    apiv1.SpaceMember_USER,
		},
	})
	require.Equal(t, codes.FailedPrecondition, status.Code(err))
}

func TestDeleteParentSpaceDeletesChildScratchpads(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	owner, err := ts.CreateRegularUser(ctx, "scratchpad-delete-owner")
	require.NoError(t, err)
	parent, err := ts.Store.CreateSpace(ctx, &store.Space{UID: "scratchpad-delete-parent", Title: "Parent"}, owner.ID)
	require.NoError(t, err)

	ownerCtx := ts.CreateUserContext(ctx, owner.ID)
	parentName := "spaces/" + parent.UID
	scratchpad, err := ts.Service.GetOrCreateSpaceScratchpad(ownerCtx, &apiv1.GetOrCreateSpaceScratchpadRequest{Parent: parentName})
	require.NoError(t, err)

	childUID := scratchpad.Name[len("spaces/"):]
	child, err := ts.Store.GetSpace(ctx, &store.FindSpace{UID: &childUID})
	require.NoError(t, err)
	content := "private child note"
	memo, err := ts.Store.CreateMemo(ctx, &store.Memo{
		UID:        "scratchpad-delete-memo",
		CreatorID:  owner.ID,
		Content:    content,
		Visibility: store.Private,
		Payload:    &storepb.MemoPayload{},
		SpaceID:    &child.ID,
	})
	require.NoError(t, err)

	_, err = ts.Service.DeleteSpace(ownerCtx, &apiv1.DeleteSpaceRequest{Name: parentName})
	require.NoError(t, err)

	spaces, err := ts.Store.ListSpaces(ctx, &store.FindSpace{UID: &childUID})
	require.NoError(t, err)
	require.Empty(t, spaces)
	deletedMemo, err := ts.Store.GetMemo(ctx, &store.FindMemo{ID: &memo.ID})
	require.NoError(t, err)
	require.Nil(t, deletedMemo)
}
