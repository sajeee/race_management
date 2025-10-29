from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import RedirectView
from django.urls import reverse_lazy

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', RedirectView.as_view(
        url=reverse_lazy('tracking:dashboard', kwargs={'race_id': 1}),
        permanent=False
    )),
    path('race/', include('tracking.urls')),  # ✅ use a prefix instead of another root
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
