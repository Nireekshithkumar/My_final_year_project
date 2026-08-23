import os
import io
import json
import logging
import pandas as pd
from pathlib import Path
from django.conf import settings
from django.core.files.storage import default_storage

logger = logging.getLogger(__name__)


class StorageAbstraction:
    """
    Unified Storage Layer for NeuralCanvas.
    Provides robust, cross-environment dataset and artifact retrieval.
    Safe on Render ephemeral disks, persistent disks, and remote object stores (S3, GCS, Cloudinary).
    Never leaks raw server filesystem paths to users.
    """

    @staticmethod
    def read_dataset_df(dataset_instance, nrows=None):
        """
        Safely reads a pandas DataFrame from a Dataset model instance.
        Tries Django Storage API first, followed by configured media root and storage candidate paths.
        Raises ValueError with a clean user-facing message if the file is unavailable.
        """
        if not dataset_instance:
            raise ValueError("Invalid dataset reference provided.")

        if not dataset_instance.file:
            raise ValueError(f"Dataset '{dataset_instance.name}' has no associated file.")

        df = None

        # 1. Primary: Read via FieldFile storage stream
        try:
            with dataset_instance.file.open('rb') as f:
                df = pd.read_csv(f, nrows=nrows)
                logger.info(f"Loaded dataset '{dataset_instance.name}' via Storage API stream.")
                return df
        except (FileNotFoundError, OSError, ValueError) as e:
            logger.warning(f"Direct storage open for '{dataset_instance.name}' failed: {e}. Trying fallback paths...")
        except Exception as e:
            logger.error(f"Unexpected error opening '{dataset_instance.name}' via storage: {e}")

        # 2. Secondary: Try candidate paths in local/persistent media directories
        candidates = []
        raw_name = str(dataset_instance.file.name)

        try:
            if hasattr(default_storage, 'path'):
                try:
                    candidates.append(default_storage.path(raw_name))
                except Exception:
                    pass
        except Exception:
            pass

        try:
            if hasattr(dataset_instance.file, 'path'):
                candidates.append(dataset_instance.file.path)
        except Exception:
            pass

        candidates.extend([
            os.path.join(str(settings.MEDIA_ROOT), raw_name),
            os.path.join(str(settings.BASE_DIR), 'media', raw_name),
            os.path.join(str(settings.BASE_DIR), raw_name),
        ])

        for cp in candidates:
            if cp and os.path.exists(cp):
                try:
                    df = pd.read_csv(cp, nrows=nrows)
                    logger.info(f"Loaded dataset '{dataset_instance.name}' via candidate path.")
                    return df
                except Exception:
                    pass

        # If all resolution attempts fail, return a clean application-level error
        raise ValueError(
            f"Dataset file '{dataset_instance.name}' is temporarily unavailable in storage. "
            "If your server was recently redeployed or restarted, please re-upload or select the dataset to continue."
        )

    @staticmethod
    def get_artifact_dir(graph_id):
        """Returns safe relative or absolute artifact directory for a graph execution."""
        artifact_path = os.path.join(str(settings.MEDIA_ROOT), 'artifacts', str(graph_id))
        os.makedirs(artifact_path, exist_ok=True)
        return artifact_path

    @staticmethod
    def save_artifact_file(graph_id, filename, content_bytes):
        """Saves binary or text artifact file safely."""
        artifact_dir = StorageAbstraction.get_artifact_dir(graph_id)
        file_path = os.path.join(artifact_dir, filename)
        with open(file_path, 'wb') as f:
            f.write(content_bytes)
        return file_path

    @staticmethod
    def get_artifact_file(graph_id, filename):
        """Retrieves artifact path if exists, otherwise None."""
        artifact_dir = os.path.join(str(settings.MEDIA_ROOT), 'artifacts', str(graph_id))
        file_path = os.path.join(artifact_dir, filename)
        if os.path.isfile(file_path):
            return file_path
        return None
