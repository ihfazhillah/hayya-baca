from django.db import migrations

SEED = [
    ("puisi", "Puisi", "🖋️", "text", 1),
    ("pantun", "Pantun", "🎴", "text", 2),
    ("cerpen", "Cerpen", "📖", "text", 3),
    ("komik", "Komik Bergambar", "🎨", "comic", 4),
    ("curhat", "Curhat Bebas", "💬", "text", 5),
]


def seed(apps, schema_editor):
    PostType = apps.get_model("diary", "PostType")
    for slug, label, emoji, kind, order in SEED:
        PostType.objects.update_or_create(
            slug=slug,
            defaults={"label": label, "emoji": emoji, "kind": kind, "order": order},
        )


def unseed(apps, schema_editor):
    PostType = apps.get_model("diary", "PostType")
    PostType.objects.filter(slug__in=[s[0] for s in SEED]).delete()


class Migration(migrations.Migration):
    dependencies = [("diary", "0001_initial")]
    operations = [migrations.RunPython(seed, unseed)]
