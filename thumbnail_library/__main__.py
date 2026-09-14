import argparse
from pathlib import Path
from .importer import import_sources


def main():
    parser = argparse.ArgumentParser(description='Local thumbnail reference library')
    parser.add_argument('command', choices=['import', 'serve'])
    parser.add_argument('--port', type=int, default=4317)
    args = parser.parse_args()
    project = Path(__file__).resolve().parent.parent
    if args.command == 'import':
        manifest = import_sources(project)
        print(f"Library contains {len(manifest['images'])} unique images.")
    else:
        from .server import serve
        serve(project, args.port)


if __name__ == '__main__':
    main()
