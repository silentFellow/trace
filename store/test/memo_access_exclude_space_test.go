package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// TestMemoAccessScopeExcludeSpaceIDsHidesMemosRegardlessOfVisibility covers
// the Scratchpad exclusion mechanism: a Space ID listed in
// MemoAccessScope.ExcludeSpaceIDs must be hidden from that caller's memo
// collection even for their own PUBLIC memos, since the point is to remove a
// Space from all-scope collections (Home, Calendar, Map, Explore), not to
// restrict visibility.
func TestMemoAccessScopeExcludeSpaceIDsHidesMemosRegardlessOfVisibility(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()

	owner, err := ts.CreateUser(ctx, &store.User{Username: "exclude-space-owner", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)

	scratchpad, err := ts.CreateSpace(ctx, &store.Space{
		UID: "exclude-space-scratchpad", Title: "Scratchpad", Payload: &storepb.SpacePayload{ExcludeFromTimeline: true},
	}, owner.ID)
	require.NoError(t, err)
	otherSpace, err := ts.CreateSpace(ctx, &store.Space{UID: "exclude-space-other", Title: "Other Space"}, owner.ID)
	require.NoError(t, err)

	unassigned, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "exclude-space-unassigned", CreatorID: owner.ID, Content: "unassigned", Visibility: store.Public,
	})
	require.NoError(t, err)
	inScratchpad, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "exclude-space-in-scratchpad", CreatorID: owner.ID, Content: "in scratchpad", Visibility: store.Public, SpaceID: &scratchpad.ID,
	})
	require.NoError(t, err)
	inOtherSpace, err := ts.CreateMemo(ctx, &store.Memo{
		UID: "exclude-space-in-other", CreatorID: owner.ID, Content: "in other space", Visibility: store.Public, SpaceID: &otherSpace.ID,
	})
	require.NoError(t, err)

	withExclusion, err := ts.ListMemos(ctx, &store.FindMemo{
		Access: &store.MemoAccessScope{UserID: &owner.ID, AllowPublic: true, AllowProtected: true, ExcludeSpaceIDs: []int32{scratchpad.ID}},
	})
	require.NoError(t, err)
	require.ElementsMatch(t, []int32{unassigned.ID, inOtherSpace.ID}, memoIDs(withExclusion),
		"a memo in an excluded Space must be hidden even though it is PUBLIC and owned by the caller")

	withoutExclusion, err := ts.ListMemos(ctx, &store.FindMemo{
		Access: &store.MemoAccessScope{UserID: &owner.ID, AllowPublic: true, AllowProtected: true},
	})
	require.NoError(t, err)
	require.ElementsMatch(t, []int32{unassigned.ID, inScratchpad.ID, inOtherSpace.ID}, memoIDs(withoutExclusion),
		"without ExcludeSpaceIDs, the Scratchpad memo is a normal, visible memo")
}
