/* app.js */

// Set up Dexie for IndexedDB storage
const db = new Dexie("PlannerDB");
db.version(1).stores({
  tasks: "++id, title, date, status, slot"
});

const { useState, useEffect, useRef } = React;

// LiveClock shows Amsterdam time in the header
function LiveClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const options = { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit", second: "2-digit" };
      setTime(now.toLocaleTimeString("nl-NL", options));
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  return <div className="text-sm">{time}</div>;
}

// UnscheduledTasks allows inline addition of tasks that aren’t scheduled yet.
function UnscheduledTasks({ tasks, addTask }) {
  const [isEditing, setIsEditing] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleAddTask = () => setIsEditing(true);
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && newTaskText.trim() !== "") {
      addTask(newTaskText, new Date().toISOString());
      setNewTaskText("");
      setIsEditing(false);
    }
  };

  return (
    <div className="mb-8">
      <h2 className="text-lg font-bold mb-2">Unscheduled Tasks</h2>
      <div className="mb-4">
        {isEditing ? (
          <input
            type="text"
            ref={inputRef}
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (newTaskText.trim() !== "") addTask(newTaskText, new Date().toISOString());
              setNewTaskText("");
              setIsEditing(false);
            }}
            className="px-4 py-2 border border-black text-black bg-white"
            placeholder="Enter task details..."
          />
        ) : (
          <button
            onClick={handleAddTask}
            className="px-4 py-2 border border-black text-black bg-white hover:bg-gray-100"
          >
            Add Task
          </button>
        )}
      </div>
      <div className="space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="draggable-task bg-gray-100 border border-gray-300 p-2 rounded cursor-move"
            data-task-id={task.id}
            data-x="0"
            data-y="0"
          >
            {task.title}
          </div>
        ))}
      </div>
    </div>
  );
}

// UnifiedSchedule renders a single row for each time slot (08:00–00:00).
// In each row, the left 200px (the pill container) holds two pill drop zones,
// and the remainder of the row is the drop zone for tasks.
function UnifiedSchedule({ tasks, pills, updateTaskSlot, updatePillStatus, timeSlots }) {
  const containerRef = useRef(null);

  useEffect(() => {
    // Set up drop zones for each time slot row.
    timeSlots.forEach((slot, index) => {
      // TASK drop zone:
      const taskZone = document.querySelector(`#task-zone-${index}`);
      if (taskZone) {
        interact(taskZone).dropzone({
          accept: ".draggable-task",
          overlap: 0.8,
          ondrop(event) {
            const taskId = event.relatedTarget.getAttribute("data-task-id");
            updateTaskSlot(taskId, slot);
            // Clear inline transforms on drop.
            gsap.set(event.relatedTarget, { clearProps: "transform" });
          }
        });
      }
      // PILL drop zones:
      const leftZone = document.querySelector(`#pill-left-${index}`);
      if (leftZone) {
        interact(leftZone).dropzone({
          accept: ".draggable-pill",
          overlap: 0.8,
          ondrop(event) {
            const pillIndex = event.relatedTarget.getAttribute("data-pill-index");
            updatePillStatus(pillIndex, false);
            gsap.set(event.relatedTarget, { clearProps: "transform" });
          }
        });
      }
      const rightZone = document.querySelector(`#pill-right-${index}`);
      if (rightZone) {
        interact(rightZone).dropzone({
          accept: ".draggable-pill",
          overlap: 0.8,
          ondrop(event) {
            const pillIndex = event.relatedTarget.getAttribute("data-pill-index");
            updatePillStatus(pillIndex, true);
            gsap.set(event.relatedTarget, { clearProps: "transform" });
          }
        });
      }
    });
  }, [tasks, pills, timeSlots]);

  // Set up global draggable behavior for tasks and pills.
  useEffect(() => {
    interact(".draggable-task").draggable({
      inertia: true,
      modifiers: [
        interact.modifiers.restrictRect({ restriction: "parent", endOnly: true })
      ],
      autoScroll: true,
      listeners: {
        move(event) {
          const target = event.target;
          let x = (parseFloat(target.getAttribute("data-x")) || 0) + event.dx;
          let y = (parseFloat(target.getAttribute("data-y")) || 0) + event.dy;
          target.style.transform = `translate(${x}px, ${y}px)`;
          target.setAttribute("data-x", x);
          target.setAttribute("data-y", y);
        },
        end(event) {
          gsap.set(event.target, { clearProps: "transform" });
        }
      }
    });
    interact(".draggable-pill").draggable({
      inertia: true,
      modifiers: [
        interact.modifiers.restrictRect({ restriction: "parent", endOnly: true })
      ],
      autoScroll: true,
      listeners: {
        move(event) {
          const target = event.target;
          let x = (parseFloat(target.getAttribute("data-x")) || 0) + event.dx;
          let y = (parseFloat(target.getAttribute("data-y")) || 0) + event.dy;
          target.style.transform = `translate(${x}px, ${y}px)`;
          target.setAttribute("data-x", x);
          target.setAttribute("data-y", y);
        },
        end(event) {
          gsap.set(event.target, { clearProps: "transform" });
        }
      }
    });
  }, [tasks, pills]);

  return (
    <div ref={containerRef}>
      {timeSlots.map((slot, index) => {
        // Filter tasks assigned to this slot.
        const slotTasks = tasks.filter((t) => t.slot === slot);
        // Get the pill state for this slot (assumes one pill per slot).
        const pill = pills.find((p) => p.id === index);
        return (
          <div key={index} className="flex items-center border border-gray-400 p-2 my-2">
            {/* Pill container: fixed 200px wide */}
            <div className="pill-container flex flex-col items-center justify-center mr-4">
              <div className="mb-1 text-sm font-mono">{slot}</div>
              <div className="flex space-x-1">
                {/* Left drop zone (Not Taken) */}
                <div
                  id={`pill-left-${index}`}
                  className="w-16 h-16 flex items-center justify-center border border-dashed border-gray-400 rounded dropzone"
                >
                  {pill && !pill.taken ? (
                    <div
                      className="draggable-pill text-3xl cursor-move"
                      data-pill-index={pill.id}
                      data-x="0"
                      data-y="0"
                    >
                      💊
                    </div>
                  ) : (
                    <span className="text-gray-300 text-xs">Not Taken</span>
                  )}
                </div>
                {/* Right drop zone (Taken) */}
                <div
                  id={`pill-right-${index}`}
                  className="w-16 h-16 flex items-center justify-center border border-dashed border-gray-400 rounded dropzone"
                >
                  {pill && pill.taken ? (
                    <div
                      className="draggable-pill text-3xl cursor-move"
                      data-pill-index={pill.id}
                      data-x="0"
                      data-y="0"
                    >
                      💊
                    </div>
                  ) : (
                    <span className="text-gray-300 text-xs">Taken</span>
                  )}
                </div>
              </div>
            </div>
            {/* Task drop zone for this time slot */}
            <div
              id={`task-zone-${index}`}
              className="flex-1 border border-dashed border-gray-400 rounded p-2 dropzone"
            >
              {slotTasks.length > 0 ? (
                slotTasks.map((task) => (
                  <div
                    key={task.id}
                    className="draggable-task bg-gray-200 border border-gray-400 p-1 rounded mb-1 cursor-move"
                    data-task-id={task.id}
                    data-x="0"
                    data-y="0"
                  >
                    {task.title}
                  </div>
                ))
              ) : (
                <div className="text-gray-300 text-xs">Drop tasks here</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function App() {
  const timeSlots = [
    "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00",
    "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00", "00:00"
  ];

  const [tasks, setTasks] = useState([]);
  const [pills, setPills] = useState(
    timeSlots.map((time, index) => ({ id: index, time, taken: false }))
  );

  useEffect(() => {
    const loadTasks = async () => {
      const allTasks = await db.tasks.toArray();
      setTasks(allTasks);
    };
    loadTasks();
  }, []);

  const addTask = async (title, date) => {
    const id = await db.tasks.add({ title, date, status: "pending", slot: null });
    setTasks([...tasks, { id, title, date, status: "pending", slot: null }]);
  };

  const updateTaskSlot = (taskId, slot) => {
    const updated = tasks.map((task) =>
      task.id.toString() === taskId ? { ...task, slot } : task
    );
    setTasks(updated);
    const taskToUpdate = updated.find((t) => t.id.toString() === taskId);
    if (taskToUpdate) db.tasks.put(taskToUpdate);
  };

  const updatePillStatus = (pillIndex, taken) => {
    setPills((prev) =>
      prev.map((p) =>
        p.id.toString() === pillIndex ? { ...p, taken } : p
      )
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="p-4 border-b border-gray-300 flex justify-between items-center">
        <h1 className="text-xl font-bold">O3‑Mini‑High Planner</h1>
        <LiveClock />
      </header>
      <main className="flex-1 p-4 overflow-auto">
        <UnscheduledTasks tasks={tasks.filter(t => t.slot === null)} addTask={addTask} />
        <UnifiedSchedule
          tasks={tasks.filter(t => t.slot !== null)}
          pills={pills}
          updateTaskSlot={updateTaskSlot}
          updatePillStatus={updatePillStatus}
          timeSlots={timeSlots}
        />
      </main>
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById("root"));
