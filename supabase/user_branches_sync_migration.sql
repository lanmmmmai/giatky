CREATE TABLE IF NOT EXISTS user_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_user_branches_user ON user_branches(user_id);
CREATE INDEX IF NOT EXISTS idx_user_branches_branch ON user_branches(branch_id);

INSERT INTO user_branches (user_id, branch_id)
SELECT id, branch_id
FROM users
WHERE role = 'staff'
  AND branch_id IS NOT NULL
ON CONFLICT (user_id, branch_id) DO NOTHING;

CREATE OR REPLACE FUNCTION sync_user_branches(
  p_user_id UUID,
  p_branch_ids UUID[],
  p_assigned_by UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM user_branches
  WHERE user_id = p_user_id
    AND NOT (branch_id = ANY(p_branch_ids));

  INSERT INTO user_branches (user_id, branch_id, assigned_by)
  SELECT p_user_id, branch_id, p_assigned_by
  FROM unnest(p_branch_ids) AS branch_id
  ON CONFLICT (user_id, branch_id) DO NOTHING;
END;
$$;

