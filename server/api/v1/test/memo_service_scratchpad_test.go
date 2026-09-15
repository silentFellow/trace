package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
	apiv1server "github.com/usememos/memos/server/api/v1"
	"github.com/usememos/memos/store"
)

func createScratchpadFixture(ctx context.Context, t *testing.T, ts *TestService, username string) (*store.User, *apiv1.Space, context.Context) {
	t.Helper()
	_, err := ts.CreateHostUser(ctx, "admin-"+username)
	require.NoError(t, err)
	created, err := ts.Service.CreateUser(ctx, &apiv1.CreateUserRequest{
		User: &apiv1.User{Username: username, Email: username + "@example.com", Password: "password123"},
	})
	require.NoError(t, err)
	user, err := ts.Store.GetUser(ctx, &store.FindUser{Username: &created.Username})
	require.NoError(t, err)
	parent, err := ts.Store.CreateSpace(ctx, &store.Space{UID: "parent-" + username, Title: "Parent"}, user.ID)
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)
	scratchpad, err := ts.Service.GetOrCreateSpaceScratchpad(userCtx, &apiv1.GetOrCreateSpaceScratchpadRequest{Parent: "spaces/" + parent.UID})
	require.NoError(t, err)
	return user, scratchpad, userCtx
}

// TestListMemosFindsOwnScratchpadMemo covers viewing the Scratchpad itself:
// all-scope memo collections exclude Scratchpad Spaces, but an explicit filter
// for the caller's own child Space must still return its memos.
func TestListMemosFindsOwnScratchpadMemo(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, scratchpad, userCtx := createScratchpadFixture(ctx, t, ts, "scratchpad-owner")
	spaceName := scratchpad.Name
	_, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{Content: "hello from scratchpad", Space: &spaceName},
	})
	require.NoError(t, err)

	resp, err := ts.Service.ListMemos(userCtx, &apiv1.ListMemosRequest{Filter: `space == "` + spaceName + `"`})
	require.NoError(t, err)
	require.Len(t, resp.Memos, 1, "an explicit Scratchpad filter must see its memos")

	combinedFilter := `(space == "` + spaceName + `") && (creator == "` + apiv1server.BuildUserName(user.Username) + `")`
	resp, err = ts.Service.ListMemos(userCtx, &apiv1.ListMemosRequest{Filter: combinedFilter})
	require.NoError(t, err)
	require.Len(t, resp.Memos, 1, "a combined Scratchpad filter must see its memos")
}

// TestGetUserStatsFindsOwnScratchpadTags covers the Scratchpad sidebar tag
// list, which uses GetUserStats scoped to the child Space.
func TestGetUserStatsFindsOwnScratchpadTags(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	user, scratchpad, userCtx := createScratchpadFixture(ctx, t, ts, "scratchpad-tags-owner")
	spaceName := scratchpad.Name
	_, err := ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{Content: "#idea a scratchpad note", Space: &spaceName},
	})
	require.NoError(t, err)

	stats, err := ts.Service.GetUserStats(userCtx, &apiv1.GetUserStatsRequest{
		Name:   apiv1server.BuildUserName(user.Username),
		Filter: `space == "` + spaceName + `"`,
	})
	require.NoError(t, err)
	require.Contains(t, stats.TagCount, "idea", "a Scratchpad tag must be counted")
}

// TestListMemosAggregatesAllOwnedScratchpads covers the global Scratchpad
// view: one OR-ed filter over every child plus the personal Scratchpad must
// return each note, while an unscoped list still hides all of them.
func TestListMemosAggregatesAllOwnedScratchpads(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()

	_, err := ts.CreateHostUser(ctx, "admin-agg")
	require.NoError(t, err)
	created, err := ts.Service.CreateUser(ctx, &apiv1.CreateUserRequest{
		User: &apiv1.User{Username: "agg-owner", Email: "agg-owner@example.com", Password: "password123"},
	})
	require.NoError(t, err)
	user, err := ts.Store.GetUser(ctx, &store.FindUser{Username: &created.Username})
	require.NoError(t, err)
	userCtx := ts.CreateUserContext(ctx, user.ID)

	var names []string
	for _, uid := range []string{"agg-a", "agg-b"} {
		parent, err := ts.Store.CreateSpace(ctx, &store.Space{UID: uid, Title: "Parent"}, user.ID)
		require.NoError(t, err)
		child, err := ts.Service.GetOrCreateSpaceScratchpad(userCtx, &apiv1.GetOrCreateSpaceScratchpadRequest{Parent: "spaces/" + parent.UID})
		require.NoError(t, err)
		names = append(names, child.Name)
		spaceName := child.Name
		_, err = ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
			Memo: &apiv1.Memo{Content: "note in " + uid, Space: &spaceName},
		})
		require.NoError(t, err)
	}
	personal, err := ts.Service.GetOrCreatePersonalScratchpad(userCtx, &apiv1.GetOrCreatePersonalScratchpadRequest{})
	require.NoError(t, err)
	personalName := personal.Name
	_, err = ts.Service.CreateMemo(userCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{Content: "personal note", Space: &personalName},
	})
	require.NoError(t, err)

	orFilter := `(space == "` + names[0] + `") || (space == "` + names[1] + `") || (space == "` + personal.Name + `")`
	resp, err := ts.Service.ListMemos(userCtx, &apiv1.ListMemosRequest{Filter: orFilter})
	require.NoError(t, err)
	require.Len(t, resp.Memos, 3, "an OR filter over every owned Scratchpad must return each note")

	all, err := ts.Service.ListMemos(userCtx, &apiv1.ListMemosRequest{})
	require.NoError(t, err)
	for _, memo := range all.Memos {
		require.NotContains(t, []string{"note in agg-a", "note in agg-b", "personal note"}, memo.Content)
	}
}
