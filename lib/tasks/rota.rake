namespace :rota do
  # Load the recurring weekly rota template (db/seed_data/weekly_template.json)
  # into care-package slots — the pattern the office staffs every week. Idempotent:
  # re-running updates slots in place, never duplicates. Creates any missing
  # template-only service users (e.g. Steven Evans) minimally.
  #
  #   bin/rails rota:template
  desc "Load the weekly rota template into care-package slots (idempotent)"
  task template: :environment do
    res = Seeding::WeeklyTemplate.call
    puts "Weekly rota template loaded:"
    puts "  clients created: #{res.clients_created}"
    puts "  slots created:   #{res.slots_created}"
    puts "  slots updated:   #{res.slots_updated}"
  end

  # Generate + publish the rolling rota horizon (default 52 weeks ahead) as
  # unassigned visits for the office to staff. Idempotent; the daily
  # Rota::EnsureHorizonJob runs the same thing. WEEKS env overrides the horizon.
  #
  #   bin/rails rota:horizon            # 52 weeks
  #   WEEKS=8 bin/rails rota:horizon    # shorter window (e.g. dev)
  desc "Generate + publish the rolling rota horizon (unassigned)"
  task horizon: :environment do
    weeks = (ENV["WEEKS"] || 52).to_i
    res = Visits::EnsureHorizon.call(weeks: weeks)
    puts "Rota horizon (#{weeks} weeks):"
    puts "  visits generated: #{res.generated}"
    puts "  visits published: #{res.published}"
  end
end
