from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated

from accounts.permissions import IsParentOrReadOnlyTeacher
from .models import QuizAttempt, ReadingProgress
from .serializers import QuizAttemptSerializer, ReadingProgressSerializer


class ReadingProgressViewSet(viewsets.ModelViewSet):
    serializer_class = ReadingProgressSerializer
    permission_classes = [IsAuthenticated, IsParentOrReadOnlyTeacher]

    def get_queryset(self):
        return ReadingProgress.objects.filter(child_id=self.kwargs["child_pk"])

    def perform_create(self, serializer):
        serializer.save(child_id=self.kwargs["child_pk"])


class QuizAttemptViewSet(
    mixins.CreateModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet
):
    serializer_class = QuizAttemptSerializer
    permission_classes = [IsAuthenticated, IsParentOrReadOnlyTeacher]

    def get_queryset(self):
        return QuizAttempt.objects.filter(child_id=self.kwargs["child_pk"])

    def perform_create(self, serializer):
        serializer.save(child_id=self.kwargs["child_pk"])
