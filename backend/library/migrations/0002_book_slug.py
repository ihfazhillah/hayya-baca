from django.db import migrations, models
from django.utils.text import slugify


def populate_slugs(apps, schema_editor):
    Book = apps.get_model("library", "Book")
    for book in Book.objects.all():
        # Use string ID as slug to match what the app stores as book_id
        slug = str(book.id)
        book.slug = slug
        book.save(update_fields=["slug"])


class Migration(migrations.Migration):

    dependencies = [
        ("library", "0001_initial"),
    ]

    operations = [
        # Step 1: Add slug field, nullable, no unique constraint yet
        migrations.AddField(
            model_name="book",
            name="slug",
            field=models.SlugField(max_length=255, blank=True, default=""),
        ),
        # Step 2: Populate slugs for existing books
        migrations.RunPython(populate_slugs, migrations.RunPython.noop),
        # Step 3: Make slug unique
        migrations.AlterField(
            model_name="book",
            name="slug",
            field=models.SlugField(max_length=255, unique=True, blank=True),
        ),
    ]
