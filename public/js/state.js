// Application state
export const state = {
    definitions: {},
    currentTimetableData: [],
    selectedDayIndex: null,
    selectedType: 'Class',
    selectedScheduleType: 'actual',
    weekOffset: 0,
    teacherAbbreviationMap: null,
    showWholeWeek: false
};

export function updateState(key, value) {
    state[key] = value;
}

export function getState(key) {
    return state[key];
}
