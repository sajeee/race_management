# tracking/tasks.py
from celery import shared_task
from .management.commands.archive_old import Command as ArchiveCommand

@shared_task
def archive_old():
    cmd = ArchiveCommand()
    cmd.handle()

