from django.db import migrations


def seed_badges(apps, schema_editor):
    Badge = apps.get_model("streaks", "Badge")
    badges = [
        {"level": 1, "name": "Benih", "icon_reference": "benih", "day_threshold": 1},
        {"level": 2, "name": "Tunas Hijau", "icon_reference": "tunas_hijau", "day_threshold": 3},
        {"level": 3, "name": "Kuncup Merah", "icon_reference": "kuncup_merah", "day_threshold": 7},
        {"level": 4, "name": "Strawberry Muda", "icon_reference": "strawberry_muda", "day_threshold": 14},
        {"level": 5, "name": "Strawberry Manis", "icon_reference": "strawberry_manis", "day_threshold": 30},
        {"level": 6, "name": "Strawberry Raksasa", "icon_reference": "strawberry_raksasa", "day_threshold": 60},
    ]
    for b in badges:
        Badge.objects.get_or_create(level=b["level"], defaults=b)


class Migration(migrations.Migration):

    dependencies = [
        ("streaks", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_badges, migrations.RunPython.noop),
    ]
