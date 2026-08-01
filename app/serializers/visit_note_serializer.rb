class VisitNoteSerializer
  def self.call(n)
    {
      id: n.id, body: n.body, author_type: n.author_type, author_id: n.author_id,
      client_note_id: n.client_note_id, supersedes_id: n.supersedes_id, created_at: n.created_at&.iso8601
    }
  end
end
