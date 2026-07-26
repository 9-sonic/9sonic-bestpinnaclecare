# A registered passkey/biometric credential. The private key never leaves the
# device; we store only the public key + a monotonic sign counter.
class WebauthnCredential < ApplicationRecord
  belongs_to :owner, polymorphic: true   # Admin | Employee
end
