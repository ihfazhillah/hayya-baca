from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
        ("library", "0002_book_slug"),
    ]

    operations = [
        migrations.CreateModel(
            name="Bookmark",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("content_type", models.CharField(
                    choices=[("book", "Book"), ("article", "Article")], max_length=16)),
                ("content_slug", models.CharField(max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_deleted", models.BooleanField(default=False)),
                ("child", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="bookmarks",
                    to="accounts.child",
                )),
            ],
            options={
                "unique_together": {("child", "content_type", "content_slug")},
            },
        ),
        migrations.AddIndex(
            model_name="bookmark",
            index=models.Index(fields=["child", "is_deleted"], name="library_boo_child_i_idx"),
        ),
    ]
