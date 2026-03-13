from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("library", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="book",
            name="slug",
            field=models.SlugField(max_length=255, unique=True, blank=True, default=""),
            preserve_default=False,
        ),
    ]
