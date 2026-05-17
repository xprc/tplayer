
import { getCurrentWindow } from '@tauri-apps/api/window';

function Lyrics() {

  const handleMouseDown = async () =>
  {
    await getCurrentWindow().startDragging();
  };

  return (
    <div 
      onMouseDown={handleMouseDown}
    >
      <div>
        test
      </div>
    </div>
  );
}

export default Lyrics;