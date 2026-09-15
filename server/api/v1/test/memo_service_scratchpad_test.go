package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
	apiv1server "github.com/usememos/memos/server/api/v1"
	"github.com/usememos/memos/store"
)

// TestListMemosFindsOwnScratchpadMemo covers viewing the Scratchpad itself:
// resolveMemoAccessScope hides the caller's Scratchpad Space from every
// all-scope memo collection (Home/Calendar/Map/Explore), but a request that
// explicitly filters for that same Space (as the Scratchpad page does) must
// still see its memos.
func TestListMemosFindsOwnScratchpadMemo(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	// A host user already exists so this exercises the normal (non-first-user)
	// creation path, matching TestCreateUserProvisionsScratchpad.
	_, err := ts.CreateHostUser(ctx, "admin")
	require.NoError(t, err)

	created, err := ts.Service.CreateUser(ctx, &apiv1.CreateUserRequest{
		User: &apiv1.User{Username: "scratchpad-owner", Email: "scratchpad-owner@example.com", Password: "password123"},
	})
	require.NoError(t, err)

	user, err := ts.Store.GetUser(ctx, &store.FindUser{Username: &created.Username})
	require.NoError(t, err)

	spaces, err := ts.Store.ListSpaces(ctx, &store.FindSpace{MemberUserID: &user.ID})
	require.NoError(t, err)
	var scratchpad *store.Space
	for _, space := range spaces {
		if space.Payload.GetExcludeFromTimeline() {
			scratchpad = space
		}
	}
	require.NotNil(t, scratchpad, "exactly one Scratchpad must be auto-provisioned per user")

	userCtx := ts.CreateUserContext(ctx, user.ID)
	spaceName := "spaces/" + scratchpad.UID
	_, err = ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{Content: "hello from scratchpad", Space: &spaceName},
	})
	require.NoError(t, err)

	resp, err := ts.Service.ListMemos(userCtx, &apiv1.ListMemosRequest{Filter: `space == "` + spaceName + `"`})
	require.NoError(t, err)
	require.Len(t, resp.Memos, 1, "a request explicitly scoped to the caller's own Scratchpad must still see its memos")

	// The Scratchpad page's real request combines the Space scope with other
	// conditions (e.g. a creator filter), the same way PagedMemoList's
	// combineCELFilters does: `(space == "...") && (creator == "...")`.
	combinedFilter := `(space == "` + spaceName + `") && (creator == "` + apiv1server.BuildUserName("scratchpad-owner") + `")`
	resp, err = ts.Service.ListMemos(userCtx, &apiv1.ListMemosRequest{Filter: combinedFilter})
	require.NoError(t, err)
	require.Len(t, resp.Memos, 1, "a combined filter naming the caller's own Scratchpad must still see its memos")
}
