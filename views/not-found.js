export const NotFoundPage = () => {
    return (
        <div class="container centre-container">
            <h1 class="centre-title">Page Not Found</h1>
            <div style="background: #fff; padding: 30px 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); line-height: 1.6; color: #333; margin-bottom: 30px; text-align: center;">
                <p style="font-size: 1.1em; color: #555; margin-top: 0px; margin-bottom: 25px;">
                    Sorry, the page you are looking for does not exist or may have been moved.
                </p>
                <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                    <a href="/" class="button-primary" style="display: inline-block; padding: 10px 20px; text-decoration: none; border-radius: 4px; color: #fff;">Return to Standings</a>
                    <a href="/game-list" class="secondary-link" style="display: inline-flex; align-items: center; padding: 10px 16px;">View Game History</a>
                </div>
            </div>
        </div>
    );
};
