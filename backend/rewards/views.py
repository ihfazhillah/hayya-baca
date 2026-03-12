from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Child
from accounts.permissions import IsParentOrReadOnlyTeacher
from .models import RewardHistory
from .serializers import BulkRewardSyncSerializer, RewardHistorySerializer


class RewardHistoryViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = RewardHistorySerializer
    permission_classes = [IsAuthenticated, IsParentOrReadOnlyTeacher]

    def get_queryset(self):
        return RewardHistory.objects.filter(child_id=self.kwargs["child_pk"])


class BulkRewardSyncView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=BulkRewardSyncSerializer, responses={201: None})
    def post(self, request, child_pk):
        child = Child.objects.get(id=child_pk)
        serializer = BulkRewardSyncSerializer(
            data=request.data, context={"child": child, "request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Synced"}, status=status.HTTP_201_CREATED)
