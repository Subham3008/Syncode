const colors = ["#58a6ff", "#3fb950", "#d29922", "#f778ba", "#a371f7", "#39c5cf"];

export const generateUserColor = (value = "") => {
  const hash = [...value].reduce((total, character) => total + character.charCodeAt(0), 0);
  return colors[hash % colors.length];
};
