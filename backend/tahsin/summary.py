"""Period ranges + score aggregation for the dashboard (Spec 072 FR5)."""
import calendar
from datetime import date, timedelta

from .models import TahsinItem, TahsinRecord, TahsinScore


def period_range(period, start):
    """Return (cur_start, cur_end, prev_start, prev_end) inclusive dates.

    week  → Monday..Sunday of `start`'s week; prev = the 7 days before.
    month → 1st..last of `start`'s month; prev = the whole previous month.
    """
    if period == "month":
        cur_start = start.replace(day=1)
        last = calendar.monthrange(cur_start.year, cur_start.month)[1]
        cur_end = cur_start.replace(day=last)
        prev_end = cur_start - timedelta(days=1)
        prev_start = prev_end.replace(day=1)
        return cur_start, cur_end, prev_start, prev_end
    # week (default)
    cur_start = start - timedelta(days=start.weekday())  # Monday
    cur_end = cur_start + timedelta(days=6)
    prev_start = cur_start - timedelta(days=7)
    prev_end = cur_start - timedelta(days=1)
    return cur_start, cur_end, prev_start, prev_end


def _avg(nums):
    return round(sum(nums) / len(nums), 2) if nums else None


def build_summary(owner, period, start, pengampu_id=None, santri_id=None):
    """Aggregate scores for the current period + the previous one."""
    cur_start, cur_end, prev_start, prev_end = period_range(period, start)

    items = list(
        TahsinItem.objects.filter(owner=owner, is_active=True).order_by("order", "id")
    )
    item_meta = {it.id: it for it in items}

    def scores_between(a, b):
        qs = TahsinScore.objects.filter(
            record__owner=owner, record__date__range=(a, b)
        )
        if pengampu_id:
            qs = qs.filter(record__santri__pengampu_id=pengampu_id)
        if santri_id:
            qs = qs.filter(record__santri_id=santri_id)
        return qs.values_list("item_id", "value", "record__santri_id")

    cur = list(scores_between(cur_start, cur_end))
    prev = list(scores_between(prev_start, prev_end))

    # Per-item averages (all santri) for current + previous.
    def per_item(rows):
        acc = {}
        for item_id, value, _sid in rows:
            acc.setdefault(item_id, []).append(value)
        return acc

    cur_item = per_item(cur)
    prev_item = per_item(prev)
    items_out = [
        {
            "id": it.id,
            "code": it.code,
            "name": it.name,
            "avg": _avg(cur_item.get(it.id, [])),
            "count": len(cur_item.get(it.id, [])),
            "prev_avg": _avg(prev_item.get(it.id, [])),
        }
        for it in items
    ]

    # Per-santri: avg per item + session count + last record.
    santri_scores = {}
    for item_id, value, sid in cur:
        santri_scores.setdefault(sid, {}).setdefault(item_id, []).append(value)

    rec_qs = TahsinRecord.objects.filter(
        owner=owner, date__range=(cur_start, cur_end)
    )
    if pengampu_id:
        rec_qs = rec_qs.filter(santri__pengampu_id=pengampu_id)
    if santri_id:
        rec_qs = rec_qs.filter(santri_id=santri_id)

    sessions = {}
    last_rec = {}
    for r in rec_qs.values("santri_id", "date", "page", "page_detail"):
        sid = r["santri_id"]
        sessions[sid] = sessions.get(sid, 0) + 1
        cur_last = last_rec.get(sid)
        if cur_last is None or r["date"] > cur_last["date"]:
            last_rec[sid] = r

    santri_ids = set(sessions) | set(santri_scores)
    from .models import Santri

    santri_rows = {
        s.id: s
        for s in Santri.objects.filter(id__in=santri_ids)
    }
    santri_out = []
    for sid in santri_ids:
        s = santri_rows.get(sid)
        if s is None:
            continue
        last = last_rec.get(sid)
        santri_out.append(
            {
                "id": sid,
                "name": s.name,
                "pengampu_id": s.pengampu_id,
                "is_pengampu": s.is_pengampu,
                "sessions": sessions.get(sid, 0),
                "last_date": last["date"].isoformat() if last else None,
                "last_page": last["page"] if last else None,
                "last_page_detail": last["page_detail"] if last else "",
                "scores": {
                    item_id: _avg(vals)
                    for item_id, vals in santri_scores.get(sid, {}).items()
                    if item_id in item_meta
                },
            }
        )
    santri_out.sort(key=lambda x: x["name"].lower())

    return {
        "period": period,
        "start": cur_start.isoformat(),
        "end": cur_end.isoformat(),
        "prev_start": prev_start.isoformat(),
        "prev_end": prev_end.isoformat(),
        "items": items_out,
        "santri": santri_out,
    }
