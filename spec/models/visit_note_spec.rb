require "rails_helper"

RSpec.describe VisitNote, type: :model do
  let(:va) { create(:visit_assignment, visit: create(:visit, service_user: create(:service_user))) }

  def note(body: "note", supersedes: nil)
    VisitNote.create!(visit_assignment: va, author: va.employee, body: body,
                      client_note_id: SecureRandom.uuid, supersedes: supersedes)
  end

  it "is append-only (edits add a new row, never mutate)" do
    n = note
    expect { n.update!(body: "changed") }.to raise_error(ActiveRecord::ReadOnlyRecord)
    expect { n.destroy }.to raise_error(ActiveRecord::ReadOnlyRecord)
  end

  it "resolves effective notes to the latest, hiding the superseded one" do
    first  = note(body: "first")
    second = note(body: "corrected", supersedes: first)
    expect(va.visit_notes.effective.pluck(:id)).to eq([ second.id ])
    expect(VisitNote.exists?(first.id)).to be(true)
  end

  it "belongs to a polymorphic author" do
    n = note
    expect(n.author).to eq(va.employee)
    expect(n.author_type).to eq("Employee")
  end
end
