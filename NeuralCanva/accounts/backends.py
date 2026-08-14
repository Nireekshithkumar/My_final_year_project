from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.db.models import Q

User = get_user_model()

class EmailBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        if not username or not password:
            return None
        try:
            users = User.objects.filter(Q(email__iexact=username) | Q(username__iexact=username))
            for user in users:
                if user.check_password(password):
                    return user
        except Exception:
            return None
        return None