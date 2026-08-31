namespace :roundsys do
  # Additive, idempotent import of the RoundSys history (staff + service users +
  # visits) from db/seed_data. Creates only what's missing and NEVER truncates,
  # so it's safe to run on every deploy and every time a fresh batch of history
  # is added to the JSON — it tops up without touching the live clock-ins carers
  # start making at go-live.
  #
  #   bin/rails roundsys:import
  #
  # Prints how many rows it added vs skipped (already present).
  desc "Import RoundSys history additively (no wipe; safe to re-run)"
  task import: :environment do
    res = Seeding::RoundsysImport.call
    puts "RoundSys import (additive):"
    puts "  carers added:        #{res.carers}"
    puts "  deactivated carers:  #{res.deactivated}"
    puts "  service users added: #{res.service_users}"
    puts "  visits added:        #{res.visits}"
    puts "  visits skipped (already present): #{res.skipped}"
  end
end
