import json
from datetime import datetime
from backend.models import db, ActivityLog


def log_activity(user_id, module, action_type, action, details=None):
    log_entry = ActivityLog(
        user_id=user_id,
        module=module,
        action_type=action_type,
        action=action,
        details=json.dumps(details) if details else None,
        timestamp=datetime.now()
    )
    db.session.add(log_entry)
    db.session.commit()
    return log_entry