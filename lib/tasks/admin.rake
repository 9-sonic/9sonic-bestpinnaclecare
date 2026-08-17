# frozen_string_literal: true

# Bootstrap the first office admin. Unlike db/seeds.rb (demo data — truncates
# and refuses production), this is idempotent and production-safe: it never
# deletes anything and will not overwrite an admin that already exists.
#
#   bin/rails admin:bootstrap
#   SEED_ADMIN_EMAIL=jesse@bestpinnaclecare.co.uk \
#     SEED_ADMIN_NAME="Jesse Ngari" bin/rails admin:bootstrap
#
# A strong random password is generated and printed ONCE, unless you pass
# SEED_ADMIN_PASSWORD yourself. MFA is required on first login (enrol then).
namespace :admin do
  desc "Create the first office admin if none exists (idempotent, prod-safe)"
  task bootstrap: :environment do
    email = ENV.fetch("SEED_ADMIN_EMAIL", "admin@bestpinnaclecare.co.uk").strip.downcase
    role  = ENV.fetch("SEED_ADMIN_ROLE", "registered_manager")
    name  = ENV.fetch("SEED_ADMIN_NAME", "Registered Manager").strip
    first, last = name.split(" ", 2)
    last = last.presence || "Admin"

    unless Admin.roles.key?(role)
      abort "SEED_ADMIN_ROLE=#{role.inspect} is invalid. One of: #{Admin.roles.keys.join(', ')}"
    end

    if (existing = Admin.find_by(email: email))
      warn "Admin #{email.inspect} already exists (id=#{existing.id}, role=#{existing.role}). Nothing to do."
      next
    end

    generated = ENV["SEED_ADMIN_PASSWORD"].blank?
    # 24 chars, cryptographically random, guaranteed to include each class so it
    # satisfies any downstream password policy.
    password = ENV["SEED_ADMIN_PASSWORD"].presence || begin
      pools = [ ("a".."z").to_a, ("A".."Z").to_a, ("0".."9").to_a, %w[! @ # $ % ^ & * ? _ -] ]
      one_each = pools.map { |p| p[SecureRandom.random_number(p.size)] }
      all      = pools.flatten
      filler   = Array.new(20) { all[SecureRandom.random_number(all.size)] }
      (one_each + filler).shuffle.join
    end

    admin = Admin.create!(
      email:              email,
      first_name:         first,
      last_name:          last,
      role:               role,
      password:           password,
      accepted_invite_at: Time.current
    )

    puts "✔ Created #{admin.role} #{admin.email} (id=#{admin.id})."
    if generated
      puts
      puts "  Generated password — shown once, store it in a password manager now:"
      puts
      puts "      #{password}"
      puts
      puts "  Log in at /api/v1/admin/auth/login, then enrol an authenticator (MFA is required)."
    end
  end
end

# Bootstrap a single carer for login testing on a real (non-dev) environment.
# Unlike db/seeds.rb (demo data — truncates and refuses production), this is
# idempotent and production-safe: it never deletes anything and will not
# overwrite a carer that already exists.
#
#   bin/rails carer:bootstrap
#   SEED_CARER_EMAIL=someone@bestpinnaclecare.co.uk \
#     SEED_CARER_NAME="Someone Else" bin/rails carer:bootstrap
namespace :carer do
  desc "Create a single carer if none exists with that email (idempotent, prod-safe)"
  task bootstrap: :environment do
    email = ENV.fetch("SEED_CARER_EMAIL", "aisha@bestpinnacle.test").strip.downcase
    name  = ENV.fetch("SEED_CARER_NAME", "Aisha Yusuf").strip
    first, last = name.split(" ", 2)
    last = last.presence || "Carer"

    if (existing = Employee.find_by(email: email))
      warn "Carer #{email.inspect} already exists (id=#{existing.id}). Nothing to do."
      next
    end

    generated = ENV["SEED_CARER_PASSWORD"].blank?
    password = ENV["SEED_CARER_PASSWORD"].presence || begin
      pools = [ ("a".."z").to_a, ("A".."Z").to_a, ("0".."9").to_a, %w[! @ # $ % ^ & * ? _ -] ]
      one_each = pools.map { |p| p[SecureRandom.random_number(p.size)] }
      all      = pools.flatten
      filler   = Array.new(20) { all[SecureRandom.random_number(all.size)] }
      (one_each + filler).shuffle.join
    end

    carer = Employee.create!(
      email:              email,
      first_name:         first,
      last_name:          last,
      role:               :carer,
      password:           password,
      active:             true,
      accepted_invite_at: Time.current
    )

    puts "✔ Created carer #{carer.email} (id=#{carer.id})."
    if generated
      puts
      puts "  Generated password — shown once, store it in a password manager now:"
      puts
      puts "      #{password}"
      puts
      puts "  Log in via the carer PWA at /api/v1/staff/auth/login."
    end
  end
end
