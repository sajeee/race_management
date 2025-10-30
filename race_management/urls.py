from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import RedirectView
from django.urls import reverse_lazy

urlpatterns = [
    path('admin/', admin.site.urls),
    path('tracking/', include(('tracking.urls', 'tracking'), namespace='tracking')),
    path('', RedirectView.as_view(url=reverse_lazy('tracking:dashboard_home'), permanent=False)),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
