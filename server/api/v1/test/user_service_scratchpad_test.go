package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
	apiv1server "github.com/usememos/memos/server/api/v1"
	"github.com/usememos/memos/store"
)

// TestCreateUserProvisionsScratchpad covers auto-provisioning: every newly
// created user gets exactly one Space flagged exclude_from_timeline, and
// that Space cannot receive invitations.
func TestCreateUserProvisionsScratchpad(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	// A host user already exists so this exercises the normal (non-first-user)
	// creation path.
	_, err := ts.CreateHostUser(ctx, "admin")
	require.NoError(t, err)

	created, err := ts.Service.CreateUser(ctx, &apiv1.CreateUserRequest{
		User: &apiv1.User{Username: "scratchpad-user", Email: "scratchpad-user@example.com", Password: "password123"},
	})
	require.NoError(t, err)

	user, err := ts.Store.GetUser(ctx, &store.FindUser{Username: &created.Username})
	require.NoError(t, err)
	require.NotNil(t, user)

	spaces, err := ts.Store.ListSpaces(ctx, &store.FindSpace{MemberUserID: &user.ID})
	require.NoError(t, err)

	var scratchpads []*store.Space
	for _, space := range spaces {
		if space.Payload.GetExcludeFromTimeline() {
			scratchpads = append(scratchpads, space)
		}
	}
	require.Len(t, scratchpads, 1, "exactly one Scratchpad must be auto-provisioned per user")

	userCtx := ts.CreateUserContext(ctx, user.ID)
	_, err = ts.Service.CreateSpaceInvitation(userCtx, &apiv1.CreateSpaceInvitationRequest{
		Parent:          "spaces/" + scratchpads[0].UID,
		SpaceInvitation: &apiv1.SpaceInvitation{Invitee: apiv1server.BuildUserName("admin"), Role: apiv1.SpaceMember_USER},
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "cannot invite members")
}
