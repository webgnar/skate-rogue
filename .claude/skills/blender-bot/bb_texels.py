"""Texel samples of a mesh: for every texel an island covers, its world position,
its face and that face's world normal. Shared by the bead and sketch passes."""
import numpy as np


def texel_samples(ob, size: int):
    me = ob.data
    M = np.array(ob.matrix_world)
    uvl = me.uv_layers.active.data
    V = np.array([(M @ np.array([*v.co, 1]))[:3] for v in me.vertices])
    FN = []
    for p in me.polygons:
        n = M[:3, :3] @ np.array(p.normal)
        FN.append(n / (np.linalg.norm(n) + 1e-9))
    FN = np.array(FN)
    P, PX, PF = [], [], []
    for fi, poly in enumerate(me.polygons):
        li = list(poly.loop_indices)
        for t in range(1, len(li) - 1):
            L = [li[0], li[t], li[t + 1]]
            uv = np.array([uvl[l].uv[:] for l in L]) * size
            T = np.array([V[me.loops[l].vertex_index] for l in L])
            A = np.array([[uv[1, 0] - uv[0, 0], uv[2, 0] - uv[0, 0]],
                          [uv[1, 1] - uv[0, 1], uv[2, 1] - uv[0, 1]]])
            if abs(np.linalg.det(A)) < 1e-9:
                continue
            Ai = np.linalg.inv(A)
            x0, y0 = np.floor(uv.min(0)).astype(int)
            x1, y1 = np.ceil(uv.max(0)).astype(int)
            xs, ys = np.meshgrid(np.arange(max(x0, 0), min(x1 + 1, size)),
                                 np.arange(max(y0, 0), min(y1 + 1, size)))
            q = np.stack([xs.ravel() + 0.5, ys.ravel() + 0.5], 1) - uv[0]
            b = q @ Ai.T
            a = 1 - b.sum(1)
            ok = (b.min(1) >= -0.02) & (a >= -0.02)
            if not ok.any():
                continue
            P.append(a[ok, None] * T[0] + b[ok, 0:1] * T[1] + b[ok, 1:2] * T[2])
            PX.append(np.stack([xs.ravel()[ok], ys.ravel()[ok]], 1))
            PF.append(np.full(ok.sum(), fi))
    P, PX, PF = np.concatenate(P), np.concatenate(PX), np.concatenate(PF)
    _, u = np.unique(PX[:, 1] * size + PX[:, 0], return_index=True)
    P, PX, PF = P[u], PX[u], PF[u]
    rows = size - 1 - PX[:, 1]          # image row of each texel (UV v runs up)
    return P, rows, PX[:, 0], PF, FN
