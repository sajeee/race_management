from celery import shared_task
from django.core.mail import send_mail

@shared_task
def notify_race_finish(runner_id, race_id):
    # placeholder: fetch runner, send an email etc
    send_mail('You finished!', 'Congrats', 'noreply@example.com', ['runner@example.com'])
