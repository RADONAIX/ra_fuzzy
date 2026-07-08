"""
RADONaix Recon MVP - Layer 1a: Normalizer
Maps AIR raw (refill / adjustment) and processed (RR / AA) extracts
into a single canonical schema used by the reconciliation engine.

Canonical schema:
    side         : 'raw' | 'proc'
    record_type  : 'REFILL' | 'ADJUSTMENT'
    txn_id       : str   (origin transaction id)
    seq_no       : str   (local sequence number)
    key          : txn_id + '|' + seq_no   (confirmed composite match key)
    event_ts_utc : pandas.Timestamp, tz-aware UTC (origin timestamp)
    hour_bucket  : event_ts_utc floored to the hour
    amount       : float (transaction amount)
    subscriber   : str or None
    source_file  : str
"""
from __future__ import annotations
import pandas as pd

UTC = "UTC"


def _parse_air_ts(series: pd.Series) -> pd.Series:
    """Raw AIR timestamps look like '20250408235657+0000'."""
    return pd.to_datetime(series, format="%Y%m%d%H%M%S%z", errors="coerce").dt.tz_convert(UTC)


def _parse_proc_ts(series: pd.Series) -> pd.Series:
    """
    Processed origin_time_stamp is stored in LOCAL time (+05:30) without offset,
    e.g. '2025-04-09 05:25:01'. Localize then convert to UTC.
    """
    ts = pd.to_datetime(series, errors="coerce")
    return ts.dt.tz_localize("Asia/Kolkata").dt.tz_convert(UTC)


def load_raw_refill(path: str) -> pd.DataFrame:
    df = pd.read_csv(
        path,
        usecols=[
            "air_rfl_rec_origin_txn_id",
            "air_rfl_rec_local_seq_no",
            "air_rfl_rec_origin_timestamp",
            "air_rfl_rec_txn_amt",
            "air_rfl_rec_subscriber_no",
            "filename",
        ],
        dtype=str,
    )
    out = pd.DataFrame(
        {
            "side": "raw",
            "record_type": "REFILL",
            "txn_id": df["air_rfl_rec_origin_txn_id"].str.strip(),
            "seq_no": df["air_rfl_rec_local_seq_no"].str.strip(),
            "event_ts_utc": _parse_air_ts(df["air_rfl_rec_origin_timestamp"]),
            "amount": pd.to_numeric(df["air_rfl_rec_txn_amt"], errors="coerce"),
            "subscriber": df["air_rfl_rec_subscriber_no"],
            "source_file": df["filename"],
        }
    )
    return _finalize(out)


def load_raw_adjustment(path: str) -> pd.DataFrame:
    df = pd.read_csv(
        path,
        usecols=[
            "air_adj_origin_transaction_id",
            "air_adj_local_sequence_number",
            "air_adj_origin_timestamp",
            "air_adj_transaction_amount",
            "air_adj_subscriber_number",
            "filename",
        ],
        dtype=str,
    )
    out = pd.DataFrame(
        {
            "side": "raw",
            "record_type": "ADJUSTMENT",
            "txn_id": df["air_adj_origin_transaction_id"].str.strip(),
            "seq_no": df["air_adj_local_sequence_number"].str.strip(),
            "event_ts_utc": _parse_air_ts(df["air_adj_origin_timestamp"]),
            "amount": pd.to_numeric(df["air_adj_transaction_amount"], errors="coerce"),
            "subscriber": df["air_adj_subscriber_number"],
            "source_file": df["filename"],
        }
    )
    return _finalize(out)


def load_processed(path: str, record_type: str) -> pd.DataFrame:
    """record_type: 'REFILL' for the RR extract, 'ADJUSTMENT' for the AA extract.
    Type is taken from the file source, not cdr_type_main (which reads 'AA' in both extracts)."""
    df = pd.read_csv(
        path,
        usecols=[
            "air_proc_origin_tran_id",
            "air_proc_local_seq_no",
            "air_proc_origin_time_stamp",
            "air_proc_tran_amt",
            "air_proc_extra4",
            "air_proc_subscriber_no",
            "filename",
        ],
        dtype=str,
    )
    # Amount mapping quirk (validated 100% vs raw on both types):
    #   RR extract: tran_amt is zeroed; true refill amount is in extra4.
    #   AA extract: tran_amt usually set; falls back to extra4 when 0.
    tran = pd.to_numeric(df["air_proc_tran_amt"], errors="coerce").fillna(0)
    extra4 = pd.to_numeric(df["air_proc_extra4"], errors="coerce").fillna(0)
    amount = tran.where(tran.abs() >= 0.005, extra4)
    out = pd.DataFrame(
        {
            "side": "proc",
            "record_type": record_type,
            "txn_id": df["air_proc_origin_tran_id"].str.strip(),
            "seq_no": df["air_proc_local_seq_no"].str.strip(),
            "event_ts_utc": _parse_proc_ts(df["air_proc_origin_time_stamp"]),
            "amount": amount,
            "subscriber": df["air_proc_subscriber_no"],
            "source_file": df["filename"],
        }
    )
    return _finalize(out)


def _finalize(df: pd.DataFrame) -> pd.DataFrame:
    df["key"] = df["txn_id"] + "|" + df["seq_no"]
    df["hour_bucket"] = df["event_ts_utc"].dt.floor("h")
    return df


def load_all(data_dir: str) -> pd.DataFrame:
    """Load and stack all four extracts into one canonical frame."""
    import os

    frames = [
        load_raw_refill(os.path.join(data_dir, "refill_record_202607071901_refill_rec_raw.csv")),
        load_raw_adjustment(os.path.join(data_dir, "adjustment_record_202607071901_adj_rec_raw.csv")),
        load_processed(os.path.join(data_dir, "air_processed_rr_202607071902_processed_rr.csv"), "REFILL"),
        load_processed(os.path.join(data_dir, "air_processed_aa_202607071902_processed_aa.csv"), "ADJUSTMENT"),
    ]
    return pd.concat(frames, ignore_index=True)
