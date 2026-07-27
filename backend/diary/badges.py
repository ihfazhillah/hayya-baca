"""Unread computation for feed badges (Spec 060 §6.1, §7)."""


def latest_activity(post, exclude_user_id=None):
    """Newest comment/reaction time, optionally ignoring one user's own."""
    comments = post.comments.all()
    reactions = post.reactions.all()
    if exclude_user_id is not None:
        comments = comments.exclude(author_id=exclude_user_id)
        reactions = reactions.exclude(user_id=exclude_user_id)
    times = []
    c = comments.order_by("-created_at").first()
    r = reactions.order_by("-created_at").first()
    if c:
        times.append(c.created_at)
    if r:
        times.append(r.created_at)
    return max(times) if times else None


def guardian_unread(post, receipt, viewer_id=None):
    """A post is unread for a guardian until they've seen its latest activity.

    The viewer's OWN comments/reactions never count as new activity — otherwise
    replying to a post you just read would flip it back to unread.
    """
    last = post.published_at or post.created_at
    la = latest_activity(post, exclude_user_id=viewer_id)
    if la and la > last:
        last = la
    if receipt is None:
        return True
    return receipt.last_seen_at < last


def child_has_new_activity(post, receipt, child_user_id):
    """True if someone else commented/reacted since the child last looked."""
    la = latest_activity(post, exclude_user_id=child_user_id)
    if la is None:
        return False
    baseline = receipt.last_seen_at if receipt else post.created_at
    return la > baseline
