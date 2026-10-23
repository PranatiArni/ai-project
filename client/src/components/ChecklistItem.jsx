function ChecklistItem({ item, onToggle, savingId }) {
  return (
    <li className={item.completed ? 'done' : undefined}>
      <label className="check-item">
        <input
          type="checkbox"
          checked={item.completed}
          disabled={savingId !== ''}
          onChange={() => onToggle(item.id)}
        />
        <span>
          {item.label}
          {savingId === item.id && <span className="saving-note"> Saving…</span>}
        </span>
      </label>
    </li>
  )
}

export default ChecklistItem
