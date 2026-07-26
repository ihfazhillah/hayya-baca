"""Ruang Cerita diary views (Spec 060)."""
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Child, ChildAccess, is_child_account
from accounts.serializers import ChildSerializer


class MeView(APIView):
    """Bootstrap payload: who am I, and which children do I see?"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if is_child_account(user):
            return Response(
                {
                    "role": "child",
                    "child": ChildSerializer(user.child_profile).data,
                }
            )

        # Guardian: diary is parent-only, so teachers get an empty list.
        children = Child.objects.filter(
            access__user=user, access__role=ChildAccess.Role.PARENT
        ).distinct()
        return Response(
            {
                "role": "guardian",
                "children": ChildSerializer(children, many=True).data,
            }
        )
