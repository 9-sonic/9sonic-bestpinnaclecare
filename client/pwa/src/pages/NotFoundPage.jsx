import { useNavigate } from 'react-router-dom';
import Button from '../components/common/Button.jsx';
import Icon from '../components/common/Icon.jsx';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="notfound">
      <span className="notfound__icon">
        <Icon name="search" size={28} />
      </span>
      <h1 className="notfound__title">Page not found</h1>
      <p className="notfound__text">
        That page does not exist, or it may have moved.
      </p>
      <Button onClick={() => navigate('/home')}>Back to home</Button>
    </div>
  );
}
