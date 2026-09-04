require "rails_helper"

RSpec.describe Assignments::WorkedTime do
  # WorkedTime reads four things off an assignment. break_seconds is computed
  # from clock events rather than stored, so a stand-in keeps these tests on the
  # merging itself instead of on building clock history.
  Stub = Struct.new(:actual_start, :actual_end, :break_seconds, :worked_minutes)

  def assignment(from:, to:, break_seconds: 0, worked: nil)
    Stub.new(from, to, break_seconds, worked)
  end

  let(:ten) { Time.zone.parse("2026-09-04 10:00") }

  it "is the plain sum when nothing overlaps" do
    list = [ assignment(from: ten, to: ten + 30.minutes),
             assignment(from: ten + 1.hour, to: ten + 90.minutes) ]
    expect(described_class.minutes(list)).to eq(60)
  end

  # The couples case: two clients at one address, one carer, one half hour.
  it "counts two fully overlapping visits once" do
    list = [ assignment(from: ten, to: ten + 30.minutes),
             assignment(from: ten, to: ten + 30.minutes) ]
    expect(described_class.minutes(list)).to eq(30)
  end

  it "counts the union when visits partly overlap" do
    list = [ assignment(from: ten, to: ten + 30.minutes),
             assignment(from: ten + 15.minutes, to: ten + 45.minutes) ]
    expect(described_class.minutes(list)).to eq(45)
  end

  it "is not limited to two — three overlapping visits are still one stretch" do
    list = Array.new(3) { assignment(from: ten, to: ten + 30.minutes) }
    expect(described_class.minutes(list)).to eq(30)
  end

  it "merges a chain that overlaps end to end" do
    list = [ assignment(from: ten, to: ten + 30.minutes),
             assignment(from: ten + 20.minutes, to: ten + 50.minutes),
             assignment(from: ten + 40.minutes, to: ten + 70.minutes) ]
    expect(described_class.minutes(list)).to eq(70)
  end

  it "still deducts recorded breaks" do
    list = [ assignment(from: ten, to: ten + 1.hour, break_seconds: 600) ]
    expect(described_class.minutes(list)).to eq(50)
  end

  it "falls back to stored worked_minutes when a visit has no clock times" do
    list = [ assignment(from: nil, to: nil, worked: 25) ]
    expect(described_class.minutes(list)).to eq(25)
  end

  it "handles a mix of clocked and unclocked assignments" do
    list = [ assignment(from: ten, to: ten + 30.minutes),
             assignment(from: ten, to: ten + 30.minutes),
             assignment(from: nil, to: nil, worked: 15) ]
    expect(described_class.minutes(list)).to eq(45)
  end

  it "is zero for nothing at all" do
    expect(described_class.minutes([])).to eq(0)
  end
end
