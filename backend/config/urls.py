from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from library.quiz_manage import QuizManagerPageView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("quiz-manager/", QuizManagerPageView.as_view(), name="quiz-manager"),
    path("api/", include("accounts.urls")),
    path("api/", include("library.urls")),
    path("api/", include("games.urls")),
    path("api/children/<int:child_pk>/", include("reading.urls")),
    path("api/children/<int:child_pk>/", include("rewards.urls")),
    # API docs
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
