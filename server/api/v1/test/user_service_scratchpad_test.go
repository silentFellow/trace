package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

// TestCreateUserDoesNotProvisionScratchpad keeps Scratchpad creation tied to a
// parent Space's first-open flow rather than account creation.
func TestCreateUserDoesNotProvisionScratchpad(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	_, err := ts.CreateHostUser(ctx, "admin")
	require.NoError(t, err)

	created, err := ts.Service.CreateUser(ctx, &apiv1.CreateUserRequest{
		User: &apiv1.User{Username: "scratchpad-user", Email: "scratchpad-user@example.com", Password: "password123"},
	})
	require.NoError(t, err)

	user, err := ts.Store.GetUser(ctx, &store.FindUser{Username: &created.Username})
	require.NoError(t, err)

	spaces, err := ts.Store.ListSpaces(ctx, &store.FindSpace{MemberUserID: &user.ID})
	require.NoError(t, err)
	for _, space := range spaces {
		require.False(t, space.Payload.GetExcludeFromTimeline(), "signup must not provision a Scratchpad without a parent Space")
	}
}
