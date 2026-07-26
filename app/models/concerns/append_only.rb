module AppendOnly
  extend ActiveSupport::Concern

  included do
    before_update  { raise ActiveRecord::ReadOnlyRecord, "#{self.class} is append-only" }
    before_destroy { raise ActiveRecord::ReadOnlyRecord, "#{self.class} is append-only" }
  end
end
