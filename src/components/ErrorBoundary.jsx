import { Component } from "react";

// Atrapa errores de render para no dejar la pantalla en blanco. Muestra un
// mensaje amable y un botón para recargar. (Tiene que ser componente de clase:
// React solo soporta error boundaries con componentDidCatch / getDerivedStateFromError.)
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Error no controlado en la UI:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="center-screen">
          <div className="empty" style={{ maxWidth: 420 }}>
            <h3>Algo salió mal</h3>
            <p>Hubo un error inesperado. Probá recargar la página.</p>
            <button
              className="btn btn-primary"
              style={{ marginTop: 12, width: "auto", padding: "10px 20px" }}
              onClick={() => window.location.reload()}
            >
              Recargar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
