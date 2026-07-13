CREATE TABLE IF NOT EXISTS message_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name_snapshot TEXT NOT NULL,
  start_index INTEGER NOT NULL CHECK (start_index >= 0),
  end_index INTEGER NOT NULL CHECK (end_index >= start_index),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (message_id, mentioned_user_id, start_index, end_index)
);

CREATE INDEX IF NOT EXISTS idx_message_mentions_message ON message_mentions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_mentions_user ON message_mentions(mentioned_user_id);

