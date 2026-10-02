import { useEffect, useRef, useState } from 'react'
import './App.css'

const topics = [
  ['Welcome to tree stewardship', 'Discover the role of trees in a healthy desert community.', 'Observe the trees around your home. Notice where they provide shade and how the surrounding soil looks.'],
  ['Understanding our desert', 'Explore the landscape and conditions that shape our local trees.', 'Compare a sunny location with a shaded one. Think about how heat, wind, and access to water differ.'],
  ['Getting to know your soil', 'Start below the surface to understand what trees need.', 'Look closely at a small patch of soil. Describe its texture, surface cover, and how water moves across it.'],
  ['Choosing the right tree', 'Connect the needs of a tree with the space where it will grow.', 'Observe a potential planting site. Consider the space above and below ground and nearby buildings.'],
  ['Planting with purpose', 'Explore the steps involved in establishing a new tree.', 'List the questions you would ask an instructor before planting a tree at your chosen site.'],
  ['Water-wise care', 'Consider how water reaches the roots in a dry climate.', 'Observe an existing watering area. Sketch where water enters and where it appears to collect.'],
  ['Capturing rainwater', 'Discover opportunities to learn from the movement of rain.', 'Sketch the direction water might travel across your site during a rainstorm.'],
  ['Mulch and healthy roots', 'Explore the relationship between soil cover and tree health.', 'Compare covered and exposed soil near trees. Record the differences you can observe.'],
  ['Pruning fundamentals', 'Learn the questions to ask before making a cut.', 'Observe the shape of a tree without pruning it. Note questions about its branching structure.'],
  ['Recognizing tree stress', 'Practice noticing changes and asking informed questions.', 'Record visible changes in leaves, branches, or surrounding soil to discuss with an instructor.'],
  ['Trees and community', 'Connect tree stewardship with the places we share.', 'Identify a community space where trees make a difference and explain why.'],
  ['Your stewardship journey', 'Reflect on what you learned and plan your next steps.', 'Write three observations you want to keep making as you continue your stewardship journey.'],
]
const modules = topics.map(([title, description, activity], index) => ({ id: index + 1, title, description, activity }))

function Tree({ large = false }) {
  return <svg className={large ? 'landscape' : 'tree-mark'} viewBox={large ? '0 0 400 280' : '0 0 40 40'} fill="none" aria-hidden="true">
    {large ? <><circle cx="285" cy="65" r="38" fill="#E6BF79"/><path d="M0 236 Q100 178 212 228 T400 214 V280 H0Z" fill="#AAB797"/><path d="M0 266 Q180 201 400 252 V280 H0Z" fill="#718C70"/><path d="M206 249V110M206 184L158 148M206 164L247 124" stroke="#D6B78A" strokeWidth="10" strokeLinecap="round"/><path d="M99 139C74 109 107 81 133 84C123 45 166 26 191 50C211 7 265 27 266 65C315 57 340 99 309 126C334 160 294 184 263 168C247 198 209 194 190 175C150 198 113 180 121 158C107 159 99 151 99 139Z" fill="#537961"/><path d="M206 173V95M206 142L167 114M206 125L240 92" stroke="#C6C9A1" strokeWidth="5" strokeLinecap="round"/><path d="M76 257V221M76 235L62 224M76 242L91 228M322 254V225M322 238L339 223" stroke="#375A46" strokeWidth="4" strokeLinecap="round"/></> : <><path d="M20 34V18M20 26L12 21M20 22L28 16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><path d="M10 23C2 18 8 10 13 11C13 2 26 2 27 10C37 9 39 23 29 25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></>}
  </svg>
}

function App() {
  const [page, setPage] = useState('Home')
  const [selected, setSelected] = useState(null)
  const [completed, setCompleted] = useState([])
  const [filter, setFilter] = useState('All modules')
  const heading = useRef(null)
  const initial = useRef(true)
  useEffect(() => {
    if (initial.current) { initial.current = false; return }
    heading.current?.focus()
  }, [page, selected])
  const next = modules.find(module => !completed.includes(module.id))
  const percent = Math.round(completed.length / modules.length * 100)
  function navigate(destination) { setSelected(null); setPage(destination) }
  function openModule(module) { setSelected(module); setPage('Modules') }
  const visible = modules.filter(module => filter === 'All modules' || (filter === 'Completed' ? completed.includes(module.id) : !completed.includes(module.id)))

  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <aside className="sidebar">
      <a className="brand" href="#home" onClick={event => { event.preventDefault(); navigate('Home') }}><Tree/><span>steward<span className="brand-light">tree</span><small>GROW YOUR KNOWLEDGE</small></span></a>
      <div className="course-label">YOUR LEARNING SPACE</div>
      <nav aria-label="Main navigation">{[['Home', '⌂'], ['Modules', '▤'], ['My progress', '◷']].map(([label, symbol]) => <button key={label} className={page === label ? 'nav-item active' : 'nav-item'} aria-current={page === label ? 'page' : undefined} onClick={() => navigate(label)}><span aria-hidden="true">{symbol}</span>{label}</button>)}</nav>
      <div className="sidebar-note"><Tree/><h3>Small steps.<br/>Stronger roots.</h3><p>A little learning today.<br/>A greener community tomorrow.</p></div>
      <div className="profile"><span className="avatar">S</span><div><strong>Sample student</strong><small>Tree Steward Program</small></div><span className="student-tag">Student</span></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><span>Tree Steward Program <span className="divider">/</span> <strong>{page}</strong></span><span className="demo-badge">Sample course</span></header>
      <main id="main" tabIndex="-1">
        {selected ? <>
          <button className="text-button back" onClick={() => setSelected(null)}>← All modules</button>
          <div className="eyebrow">WEEK {String(selected.id).padStart(2, '0')} · LEARNING MODULE</div>
          <h1 ref={heading} tabIndex="-1">{selected.title}</h1><p className="intro">{selected.description}</p>
          <article className="lesson panel"><span className="pill">Sample lesson</span><h2>Take a closer look</h2><p>This introductory activity is a placeholder for your instructor’s course material. The final module will include readings, media, and assessments provided by the program.</p><h3>Try an observation</h3><p>{selected.activity}</p><div className="reflection"><h3>Pause and reflect</h3><p>What did you notice? Bring one observation and one question to your next class.</p></div><button className="primary" onClick={() => setCompleted(previous => previous.includes(selected.id) ? previous.filter(id => id !== selected.id) : [...previous, selected.id])}>{completed.includes(selected.id) ? 'Mark as incomplete' : 'Mark module complete'} <span aria-hidden="true">✓</span></button><p className="save-note" role="status">{completed.includes(selected.id) ? 'Module completed. Your demo progress is updated.' : 'Progress is for this demo session and resets on refresh.'}</p></article>
          <div className="lesson-nav"><button disabled={selected.id === 1} className="secondary" onClick={() => openModule(modules[selected.id - 2])}>← Previous week</button><button disabled={selected.id === 12} className="secondary" onClick={() => openModule(modules[selected.id])}>Next week →</button></div>
        </> : <>
          <div className="page-heading"><div><div className="eyebrow">LEARN. CARE. MAKE A DIFFERENCE.</div><h1 ref={heading} tabIndex="-1">{page === 'Home' ? 'Welcome to your growing journey.' : page === 'Modules' ? 'One week at a time.' : 'See how far you’ve grown.'}</h1><p className="intro">{page === 'Home' ? 'Build the knowledge to care for trees and the community around you.' : page === 'Modules' ? 'Explore your 12-week introduction to desert tree stewardship.' : 'Every completed module is another step in your stewardship journey.'}</p></div></div>
          {page === 'Home' && <section className="hero"><div className="hero-copy"><span className="hero-label">YOUR NEXT CHAPTER · {next ? `WEEK ${String(next.id).padStart(2, '0')}` : 'COURSE COMPLETE'}</span><h2>{next ? next.title : 'A strong foundation for what’s next.'}</h2><p>{next ? next.description : 'You have completed all 12 sample modules. Revisit any week to keep exploring.'}</p><button className="primary" onClick={() => next ? openModule(next) : navigate('Modules')}>{next ? (completed.length ? 'Continue learning' : 'Start learning') : 'Review modules'} <span aria-hidden="true">→</span></button></div><Tree large/></section>}
          <div className="content-grid"><section className="module-section">
            {page === 'My progress' ? <><div className="section-title"><h2>Your learning record</h2><span>{completed.length} of 12 completed</span></div><div className="module-list">{modules.map(module => <button className="module-row" key={module.id} onClick={() => openModule(module)}><span className={`week-number ${completed.includes(module.id) ? 'done' : ''}`}>{completed.includes(module.id) ? '✓' : String(module.id).padStart(2, '0')}</span><span className="module-text"><strong>{module.title}</strong><small>{completed.includes(module.id) ? 'Completed' : 'Not completed'}</small></span><span aria-hidden="true">→</span></button>)}</div></> : <><div className="section-title"><h2>{page === 'Home' ? 'Your learning path' : 'Course modules'}</h2>{page === 'Home' && <button className="text-button" onClick={() => navigate('Modules')}>View all 12 weeks →</button>}</div>{page === 'Modules' && <div className="filters" aria-label="Filter modules">{['All modules', 'To do', 'Completed'].map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}</button>)}</div>}<div className="module-list">{(page === 'Home' ? modules.slice(0, 4) : visible).map(module => <button className="module-row" key={module.id} onClick={() => openModule(module)}><span className={`week-number ${completed.includes(module.id) ? 'done' : ''}`}>{completed.includes(module.id) ? '✓' : String(module.id).padStart(2, '0')}</span><span className="module-text"><small>WEEK {module.id}</small><strong>{module.title}</strong><span>{module.description}</span></span><span className={`status ${completed.includes(module.id) ? 'complete' : ''}`}>{completed.includes(module.id) ? 'Completed' : next?.id === module.id ? 'Up next' : 'Explore'}</span><span className="row-arrow" aria-hidden="true">↗</span></button>)}</div>{page === 'Modules' && visible.length === 0 && <div className="empty panel"><h3>{filter === 'Completed' ? 'Your first step starts here.' : 'All caught up!'}</h3><p>{filter === 'Completed' ? 'Complete a module to see it in this list.' : 'You have completed all the sample modules.'}</p><button className="text-button" onClick={() => setFilter('All modules')}>See all modules →</button></div>}</>}
          </section><aside className="right-column"><section className="panel progress-card"><div className="section-title"><h2>Your progress</h2><span aria-hidden="true">↗</span></div><div className="progress-number">{percent}<span>%</span></div><progress value={completed.length} max="12" aria-label="Course completion"/><p><strong>{completed.length} of 12</strong> modules completed</p><div className="encouragement">{completed.length === 12 ? 'All twelve weeks explored. Keep growing!' : 'Every small step helps you grow.'}</div></section><section className="field-note"><span className="eyebrow">ROOTED IN COMMUNITY</span><h2>Learning that lives<br/>beyond the screen.</h2><p>Take your curiosity outdoors. Notice a tree, ask a question, and bring your observations to class.</p><span className="note-line" aria-hidden="true">✳</span></section></aside></div>
        </>}
        <footer><span>Steward Tree · Desert tree stewardship</span><span>Prototype · Sample curriculum · Progress resets on refresh</span></footer>
      </main>
    </div>
  </div>
}
export default App
