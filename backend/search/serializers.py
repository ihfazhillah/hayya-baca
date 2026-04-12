from rest_framework import serializers

from .models import SearchLog


class SearchResultSerializer(serializers.Serializer):
    slug = serializers.CharField()
    type = serializers.CharField()
    title = serializers.CharField()
    categories = serializers.ListField(child=serializers.CharField())
    cover_url = serializers.CharField(allow_null=True, required=False)
    already_read = serializers.BooleanField()
    score = serializers.FloatField()


class SuggestionSerializer(serializers.Serializer):
    phrase = serializers.CharField()
    source = serializers.CharField()


class SearchLogCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SearchLog
        fields = ["query", "result_slug", "result_type"]
