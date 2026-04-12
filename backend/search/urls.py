from django.urls import path

from .views import SearchLogCreateView, SearchView, SuggestView

urlpatterns = [
    path("", SearchView.as_view(), name="search"),
    path("suggest/", SuggestView.as_view(), name="search-suggest"),
    path("log/", SearchLogCreateView.as_view(), name="search-log"),
]
