// Application state
export const state = {
    definitions: {},
    currentTimetableData: [],
    selectedDayIndex: null,
    selectedType: 'Class',
    selectedScheduleType: 'actual',
    selectedGroup: 'all',
    weekOffset: 0
};

export function updateState(key, value) {
    state[key] = value;
}

export function getState(key) {
    return state[key];
}
