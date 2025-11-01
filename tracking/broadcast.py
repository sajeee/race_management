# tracking/broadcast.py
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

def broadcast_to_race_sync(race_id: int, payload: dict, msg_type: str = "race_update"):
    """
    Synchronous helper (for sync contexts).
    """
    layer = get_channel_layer()
    async_to_sync(layer.group_send)(
        f"race_{race_id}",
        {"type": msg_type, "message": payload},
    )

async def broadcast_to_race_async(race_id: int, payload: dict, msg_type: str = "race_update"):
    """
    Async helper (for async contexts).
    """
    layer = get_channel_layer()
    await layer.group_send(
        f"race_{race_id}",
        {"type": msg_type, "message": payload},
    )
