# Append-only audit log. Only writer is Events::Record.call.
class Event < ApplicationRecord
  include AppendOnly

  belongs_to :aggregate, polymorphic: true
  belongs_to :actor, polymorphic: true, optional: true   # Admin | Employee | (System = nil)
end
