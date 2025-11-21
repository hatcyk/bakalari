import { dom } from './dom.js';
import { days, lessonTimes } from './constants.js';
import { state, updateState } from './state.js';
import { loadTimetable, populateValueSelect } from './timetable.js';
import { parseChangeInfo } from './utils.js';
import { setDropdownValue, openDropdown } from './dropdown.js';

// Modal functions
export function showLessonModal(lesson) {
    if (!dom.lessonModal) {
        console.error('Modal not initialized!');
        return;
    }

    // Set subject name (full name, not abbreviated)
    document.getElementById('modalSubject').textContent = lesson.subject || 'Neznámá hodina';

    // Set teacher (full name) with clickable link
    const teacherEl = document.getElementById('modalTeacher');
    if (lesson.teacher && state.selectedType !== 'Teacher') {
        teacherEl.innerHTML = `<a href="#" class="modal-link" data-type="Teacher" data-name="${lesson.teacher}">${lesson.teacher}</a>`;
    } else {
        teacherEl.textContent = lesson.teacher || 'Není zadáno';
    }

    // Set room (with clickable link if room exists)
    const roomEl = document.getElementById('modalRoom');
    if (lesson.room && state.selectedType !== 'Room') {
        roomEl.innerHTML = `<a href="#" class="modal-link" data-type="Room" data-name="${lesson.room}">${lesson.room}</a>`;
    } else {
        roomEl.textContent = lesson.room || 'Není zadáno';
    }

    // Set hour with time range
    const timeInfo = lessonTimes.find(t => t.hour === lesson.hour);
    const hourText = timeInfo ? `${lesson.hour}. hodina (${timeInfo.label})` : `${lesson.hour}. hodina`;
    document.getElementById('modalHour').textContent = hourText;

    // Set group (if exists) and extract class name for link
    const modalGroupContainer = document.getElementById('modalGroupContainer');
    if (lesson.group) {
        // Parse group to get class name
        const groupMatch = lesson.group.match(/^([^\s]+)\s+/);
        const className = groupMatch ? groupMatch[1] : null;

        if (className && state.selectedType === 'Class') {
            // If viewing a class, just show group name
            document.getElementById('modalGroup').textContent = lesson.group;
        } else if (className) {
            // If viewing teacher/room, make class name clickable
            const groupEl = document.getElementById('modalGroup');
            groupEl.innerHTML = `<a href="#" class="modal-link" data-type="Class" data-name="${className}">${lesson.group}</a>`;
        } else {
            document.getElementById('modalGroup').textContent = lesson.group;
        }
        modalGroupContainer.style.display = 'flex';
    } else {
        modalGroupContainer.style.display = 'none';
    }

    // Set theme (if exists)
    const modalThemeContainer = document.getElementById('modalThemeContainer');
    if (lesson.theme) {
        document.getElementById('modalTheme').textContent = lesson.theme;
        modalThemeContainer.style.display = 'flex';
    } else {
        modalThemeContainer.style.display = 'none';
    }

    // Set changes (if exists)
    const modalChanges = document.getElementById('modalChanges');
    const modalChangesContent = document.getElementById('modalChangesContent');

    if (lesson.changed && lesson.changeInfo) {
        modalChanges.classList.remove('hidden');

        // Parse change info for better understanding
        const parsed = parseChangeInfo(lesson.changeInfo.description);

        if (parsed && parsed.formatted) {
            // Display formatted change info with line breaks
            modalChangesContent.innerHTML = parsed.formatted.replace(/\n/g, '<br>');
        } else {
            modalChangesContent.textContent = lesson.changeInfo.description || 'Tato hodina byla změněna oproti stálému rozvrhu.';
        }
    } else if (lesson.changed) {
        modalChanges.classList.remove('hidden');
        modalChangesContent.textContent = 'Tato hodina byla změněna oproti stálému rozvrhu.';
    } else {
        modalChanges.classList.add('hidden');
    }

    // Show modal
    dom.lessonModal.classList.remove('hidden');
    dom.lessonModal.style.display = 'flex';

    // Add click listeners to modal links
    setupModalLinks();
}

export function closeLessonModal() {
    if (dom.lessonModal) {
        // Add closing animation
        dom.lessonModal.classList.add('modal-closing');

        // Wait for animation to complete before hiding
        setTimeout(() => {
            dom.lessonModal.classList.remove('modal-closing');
            dom.lessonModal.classList.add('hidden');
            dom.lessonModal.style.display = 'none';
        }, 200);
    }
}

// Setup click listeners for modal links (teacher, room, class)
function setupModalLinks() {
    const links = dom.lessonModal.querySelectorAll('.modal-link');
    links.forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const type = link.dataset.type;
            const name = link.dataset.name;

            // Close modal
            closeLessonModal();

            // Find the ID for this teacher/room/class
            const definitions = state.definitions;
            let targetId = null;

            if (type === 'Teacher') {
                const teacher = definitions.teachers?.find(t => t.name === name);
                targetId = teacher?.id;
            } else if (type === 'Room') {
                const room = definitions.rooms?.find(r => r.name === name);
                targetId = room?.id;
            } else if (type === 'Class') {
                const cls = definitions.classes?.find(c => c.name === name);
                targetId = cls?.id;
            }

            if (targetId) {
                // Update state
                updateState('selectedType', type);

                // Update UI buttons
                const typeButtons = document.querySelectorAll('.type-btn');
                typeButtons.forEach(btn => {
                    if (btn.dataset.type === type) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });

                // Populate and select
                populateValueSelect();
                setDropdownValue(targetId);

                // Load timetable
                await loadTimetable();

                // Auto-open dropdown to show options
                openDropdown();
            }
        });
    });
}

// Initialize modal event listeners
export function initModalListeners() {
    if (!dom.lessonModal || !dom.modalClose) {
        console.error('Modal elements not found during initialization');
        return;
    }

    // Close button
    dom.modalClose.addEventListener('click', (e) => {
        e.stopPropagation();
        closeLessonModal();
    });

    // Click outside modal
    dom.lessonModal.addEventListener('click', (e) => {
        if (e.target === dom.lessonModal) {
            closeLessonModal();
        }
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && dom.lessonModal && !dom.lessonModal.classList.contains('hidden')) {
            closeLessonModal();
        }
    });

    console.log('Modal listeners initialized successfully');
}
