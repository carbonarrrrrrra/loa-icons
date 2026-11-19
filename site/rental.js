// Rental lineup source: https://yukinoko334.github.io/pricone_crsp_checker/data/rental_parties.json
function ownedTile(unit) {
  const card = el('div', 'owned-tile');
  card.append(mini(unit, null));
  if (!owned.has(unit.id)) return card;
  const pair = training[unit.id] || [null, null];
  for (const [index, label] of ['CR', '専用SP'].entries()) {
    const field = el('label', '', label);
    const select = el('select');
    select.setAttribute('aria-label', unit.name + 'の' + label);
    const values = index === 0 ? Array.from({length:16}, (_, n) => n) : [false, true];
    const options = [null, ...values];
    for (const value of options) {
      const name = value === null ? '未入力' : index === 0 ? String(value) : value ? '有' : '無';
      select.append(new Option(name, String(value), false, pair[index] === value));
    }
    select.disabled = sharedView;
    select.onchange = () => {
      checkpoint();
      const next = [...(training[unit.id] || [null, null])];
      next[index] = options[select.selectedIndex];
      if (next.every(value => value === null)) delete training[unit.id];
      else training[unit.id] = next;
      save();
      refreshRental();
    };
    field.append(select);
    card.append(field);
  }
  return card;
}

let rentalRequest;
async function refreshRental() {
  const panel = document.querySelector('#rental');
  if (!panel?.open || !ready) return;
  const result = document.querySelector('#rental-results');
  try {
    rentalRequest ||= fetch('rental-parties.json').then(response => {
      if (!response.ok) throw Error();
      return response.json();
    });
    const parties = await rentalRequest;
    result.replaceChildren(el('p', '', '手持ち → レンタル。未入力の項目は集計対象外です。'));
    for (const party of parties) {
      const heading = el('h3', '', party.element + '属性・' + party.type);
      const members = el('div', 'rental-members');
      let gain = 0, newSp = 0;
      for (const member of party.members) {
        const unit = byId.get(member.id);
        const tile = el('div', 'rental-member');
        const have = owned.has(member.id);
        const [cr, sp] = have ? training[member.id] || [null, null] : [0, false];
        if (unit) {
          const image = el('img');
          image.src = chosen(unit).url;
          image.alt = '';
          tile.append(image);
        }
        const diff = cr === null || member.cr === null ? null : member.cr - cr;
        const rank = el('span', diff > 0 ? 'gain' : diff < 0 ? 'loss' : '',
          'CR ' + (cr ?? '未入力') + ' → ' + (member.cr ?? '?') + (diff > 0 ? ' (+' + diff + ')' : ''));
        const acquired = sp === false && member.sp === true;
        gain += Math.max(0, diff ?? 0);
        if (acquired) newSp++;
        const flag = value => value === null ? '?' : value ? '有' : '無';
        tile.append(el('strong','',unit?.name || member.id), el('small','',have?'所持':'未所持'), rank,
          el('span',acquired?'gain':'','SP ' + (sp === null?'未入力':flag(sp)) + ' → ' + flag(member.sp)));
        members.append(tile);
      }
      result.append(heading, members, el('p','','CR上昇分の合計 +' + gain + ' ／ 専用SP新規 ' + newSp + '人'));
    }
  } catch {
    rentalRequest = null;
    result.textContent = '編成を読み込めませんでした。閉じてもう一度開いてください。';
  }
}
document.querySelector('#rental').ontoggle = refreshRental;
